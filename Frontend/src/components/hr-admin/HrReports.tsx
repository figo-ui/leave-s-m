import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiService } from '../../utils/api';
import { useTranslation } from 'react-i18next';
import './HRReports.css';

// Enhanced Type Definitions
interface HRReportData {
  summary: {
    totalEmployees: number;
    totalLeaves: number;
    approvedLeaves: number;
    pendingLeaves: number;
    rejectedLeaves: number;
    averageLeaveDuration: number;
    totalLeaveDays: number;
    onLeaveToday: number;
    pendingApprovals: number;
  };
  departmentStats: Array<{
    department: string;
    employeeCount: number;
    totalLeaves: number;
    approvedLeaves: number;
    rejectedLeaves: number;
    averageDuration: number;
    approvalRate: number;
  }>;
  leaveTypeStats: Array<{
    leaveType: string;
    totalRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    averageDuration: number;
    utilizationRate: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    leavesTaken: number;
    approvalRate: number;
    averageDuration: number;
  }>;
  employeeInsights: Array<{
    employeeName: string;
    department: string;
    leavesTaken: number;
    totalDays: number;
    approvalRate: number;
  }>;
  complianceData: {
    policyViolations: number;
    lateApplications: number;
    overlappingLeaves: number;
    highFrequencyEmployees: number;
  };
  reportPeriod: {
    startDate: string;
    endDate: string;
  };
}

interface ComparisonData {
  previousPeriod: HRReportData;
  currentPeriod: HRReportData;
  growth: {
    totalLeaves: number;
    approvalRate: number;
    averageDuration: number;
  };
}

const HRReports: React.FC = () => {
  const { t, i18n } = useTranslation();
  const localeMap: Record<string, string> = { en: 'en-US', am: 'am-ET', om: 'om-ET' };
  const locale = localeMap[i18n.language] || 'en-US';

  const [reportData, setReportData] = useState<HRReportData | null>(null);
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'compliance' | 'employees'>('overview');
  const [dateRange, setDateRange] = useState<'month' | 'quarter' | 'year' | 'custom'>('quarter');
  const [customDateRange, setCustomDateRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');

  // Memoized calculations with null checks
  const departmentOptions = useMemo(() => {
    if (!reportData?.departmentStats) return [];
    return [
      { value: 'all', label: t('hr_reports.all_departments') },
      ...reportData.departmentStats.map(dept => ({
        value: dept.department,
        label: t('hr_reports.department_option', { department: dept.department, count: dept.employeeCount })
      }))
    ];
  }, [reportData, t]);

  const filteredData = useMemo(() => {
    if (!reportData) return null;

    const data = { ...reportData };

    // Filter by department
    if (selectedDepartment !== 'all') {
      data.departmentStats = data.departmentStats.filter(
        dept => dept.department === selectedDepartment
      );
      
      // Filter employee insights
      data.employeeInsights = data.employeeInsights.filter(
        emp => emp.department === selectedDepartment
      );
    }

    // Filter by status if needed
    if (filterType !== 'all') {
      // This would require more detailed filtering logic
      // For now, we adjust the summary
      if (filterType === 'approved') {
        data.summary.totalLeaves = data.summary.approvedLeaves;
      } else if (filterType === 'pending') {
        data.summary.totalLeaves = data.summary.pendingLeaves;
      } else if (filterType === 'rejected') {
        data.summary.totalLeaves = data.summary.rejectedLeaves;
      }
    }

    return data;
  }, [reportData, selectedDepartment, filterType]);

  const growthMetrics = useMemo(() => {
    if (!comparisonData?.currentPeriod?.summary || !comparisonData?.previousPeriod?.summary) return null;

    return {
      totalLeaves: {
        current: comparisonData.currentPeriod.summary.totalLeaves,
        previous: comparisonData.previousPeriod.summary.totalLeaves,
        growth: comparisonData.growth.totalLeaves,
        trend: comparisonData.growth.totalLeaves >= 0 ? 'up' : 'down'
      },
      approvalRate: {
        current: comparisonData.currentPeriod.summary.approvedLeaves / 
                comparisonData.currentPeriod.summary.totalLeaves * 100 || 0,
        previous: comparisonData.previousPeriod.summary.approvedLeaves / 
                 comparisonData.previousPeriod.summary.totalLeaves * 100 || 0,
        growth: comparisonData.growth.approvalRate,
        trend: comparisonData.growth.approvalRate >= 0 ? 'up' : 'down'
      },
      averageDuration: {
        current: comparisonData.currentPeriod.summary.averageLeaveDuration,
        previous: comparisonData.previousPeriod.summary.averageLeaveDuration,
        growth: comparisonData.growth.averageDuration,
        trend: comparisonData.growth.averageDuration >= 0 ? 'up' : 'down'
      }
    };
  }, [comparisonData]);

  const complianceScore = useMemo(() => {
    if (!filteredData?.complianceData || !filteredData?.summary?.totalEmployees) return 100;

    const violations = 
      filteredData.complianceData.policyViolations * 2 +
      filteredData.complianceData.lateApplications * 1 +
      filteredData.complianceData.overlappingLeaves * 3 +
      filteredData.complianceData.highFrequencyEmployees * 2;

    const totalEmployees = filteredData.summary.totalEmployees;
    const maxViolations = totalEmployees * 10; // Theoretical maximum
    const score = 100 - (violations / maxViolations) * 100;
    
    return Math.max(0, Math.min(100, score));
  }, [filteredData]);

  // Data loading
  const loadReportData = useCallback(async (startDate?: string, endDate?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      
      const response = await apiService.getHrReportsAnalytics(params);
      
      if (response.success && response.data) {
        setReportData(response.data);
        
        // Load comparison data
        loadComparisonData(response.data);
      } else {
        throw new Error(response.message || t('hr_reports.errors.load_failed'));
      }
    } catch (error: any) {
      console.error('Error loading HR report data:', error);
      setError(error.message || t('hr_reports.errors.load_failed'));
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadComparisonData = useCallback(async (currentData: HRReportData) => {
    try {
      // Calculate previous period
      const currentStart = new Date(currentData.reportPeriod.startDate);
      const periodMs = new Date(currentData.reportPeriod.endDate).getTime() - currentStart.getTime();
      const previousEnd = new Date(currentStart.getTime() - 1);
      const previousStart = new Date(previousEnd.getTime() - periodMs);

      const previousResponse = await apiService.getHrReportsAnalytics({
        startDate: previousStart.toISOString().split('T')[0],
        endDate: previousEnd.toISOString().split('T')[0]
      });

      if (previousResponse.success && previousResponse.data) {
        const comparison: ComparisonData = {
          previousPeriod: previousResponse.data,
          currentPeriod: currentData,
          growth: {
            totalLeaves: calculateGrowth(
              previousResponse.data.summary.totalLeaves,
              currentData.summary.totalLeaves
            ),
            approvalRate: calculateGrowth(
              previousResponse.data.summary.approvedLeaves / previousResponse.data.summary.totalLeaves * 100 || 0,
              currentData.summary.approvedLeaves / currentData.summary.totalLeaves * 100 || 0
            ),
            averageDuration: calculateGrowth(
              previousResponse.data.summary.averageLeaveDuration,
              currentData.summary.averageLeaveDuration
            )
          }
        };
        setComparisonData(comparison);
      }
    } catch (error) {
      console.error('Error loading comparison data:', error);
      // Don't fail the whole report if comparison fails
    }
  }, []);

  const calculateGrowth = (previous: number, current: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  // Date range handling
  const handleDateRangeChange = useCallback((range: 'month' | 'quarter' | 'year' | 'custom') => {
    setDateRange(range);
    
    const endDate = new Date();
    let startDate: Date;
    
    switch (range) {
      case 'month':
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.floor(endDate.getMonth() / 3);
        startDate = new Date(endDate.getFullYear(), quarter * 3, 1);
        break;
      case 'year':
        startDate = new Date(endDate.getFullYear(), 0, 1);
        break;
      case 'custom':
        return; // Let user set custom dates
    }
    
    loadReportData(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );
  }, [loadReportData]);

  // Export functionality
  const handleExport = useCallback(async (format: 'csv' | 'pdf' | 'excel') => {
    if (!reportData) {
      alert(t('hr_reports.errors.no_data_export'));
      return;
    }

    try {
      setExporting(true);
      
      // Mock export for now - implement actual API call
      const data = reportData;
      if (format === 'csv') {
        exportToCSV(data);
      } else if (format === 'pdf') {
        generatePDF();
      } else {
        exportToExcel();
      }
    } catch (error: any) {
      console.error('Export error:', error);
      alert(t('hr_reports.errors.export_failed', { message: error.message }));
    } finally {
      setExporting(false);
    }
  }, [reportData, t]);

  const exportToCSV = (data: any) => {
    // Create CSV content
    const csvContent = Object.entries(data.summary)
      .map(([key, value]) => `${key},${value}`)
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `hr-report-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const generatePDF = () => {
    alert(t('hr_reports.export_pdf_soon'));
  };

  const exportToExcel = () => {
    alert(t('hr_reports.export_excel_soon'));
  };

  // Initial load
  useEffect(() => {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth() - 3, 1); // Last quarter
    loadReportData(
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    );
  }, [loadReportData]);

  // Formatting helpers with null checks
  const formatNumber = useCallback((num: number | undefined | null): string => {
    if (num === undefined || num === null) return '0';
    return num.toLocaleString();
  }, []);

  const formatPercentage = useCallback((num: number | undefined | null): string => {
    if (num === undefined || num === null) return '0%';
    return `${num.toFixed(1)}%`;
  }, []);

  const formatDate = useCallback((dateString: string | undefined | null): string => {
    if (!dateString) return t('common.na');
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }, [locale, t]);

  const getTrendIcon = useCallback((trend: 'up' | 'down' | 'neutral', value: number) => {
    if (trend === 'up') {
      return value >= 0 ? '📈' : '📉';
    }
    return value >= 0 ? '📉' : '📈';
  }, []);

  const getComplianceLevel = useCallback((score: number): string => {
    if (score >= 90) return t('hr_reports.compliance.level.excellent');
    if (score >= 75) return t('hr_reports.compliance.level.good');
    if (score >= 60) return t('hr_reports.compliance.level.fair');
    return t('hr_reports.compliance.level.needs_improvement');
  }, [t]);

  // Loading state
  if (loading) {
    return (
      <div className="hr-reports">
        <div className="page-header">
          <h1>{t('hr_reports.title')}</h1>
          <p>{t('hr_reports.subtitle')}</p>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>{t('hr_reports.loading_data')}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !reportData) {
    return (
      <div className="hr-reports">
        <div className="page-header">
          <h1>{t('hr_reports.title')}</h1>
          <p>{t('hr_reports.subtitle')}</p>
        </div>
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h3>{t('hr_reports.error_title')}</h3>
          <p>{error}</p>
          <button onClick={() => loadReportData()} className="btn-primary">
            {t('hr_reports.try_again')}
          </button>
        </div>
      </div>
    );
  }

  // No data state
  if (!reportData) {
    return (
      <div className="hr-reports">
        <div className="page-header">
          <h1>{t('hr_reports.title')}</h1>
          <p>{t('hr_reports.subtitle')}</p>
        </div>
        <div className="no-data-state">
          <div className="no-data-icon">📊</div>
          <h3>{t('hr_reports.no_data_title')}</h3>
          <p>{t('hr_reports.no_data_desc')}</p>
          <button onClick={() => loadReportData()} className="btn-primary">
            {t('hr_reports.load_data')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hr-reports">
      {/* Header Section */}
      <div className="page-header">
        <div className="header-content">
          <div className="header-title">
            <h1>{t('hr_reports.title')}</h1>
            <p>{t('hr_reports.subtitle')}</p>
            <div className="header-subtitle">
              <span className="period-info">
                {t('hr_reports.period', {
                  start: formatDate(reportData.reportPeriod?.startDate),
                  end: formatDate(reportData.reportPeriod?.endDate)
                })}
              </span>
              <span className="employee-count">
                📊 {formatNumber(reportData.summary?.totalEmployees)} {t('hr_reports.total_employees')}
              </span>
            </div>
          </div>
          
          <div className="header-actions">
            <div className="export-dropdown">
              <button className="btn-export" disabled={exporting}>
                {exporting ? t('hr_reports.exporting') : t('hr_reports.export_report')}
              </button>
              <div className="export-menu">
                <button onClick={() => handleExport('csv')} className="export-option">
                  📄 {t('hr_reports.export_csv')}
                </button>
                <button onClick={() => handleExport('pdf')} className="export-option">
                  📊 {t('hr_reports.export_pdf')}
                </button>
                <button onClick={() => handleExport('excel')} className="export-option">
                  📈 {t('hr_reports.export_excel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls Section */}
      <div className="controls-section">
        <div className="controls-row">
          <div className="control-group">
            <label>{t('hr_reports.date_range')}</label>
            <div className="date-range-buttons">
              {(['month', 'quarter', 'year', 'custom'] as const).map(range => (
                <button
                  key={range}
                  className={`range-btn ${dateRange === range ? 'active' : ''}`}
                  onClick={() => handleDateRangeChange(range)}
                >
                  {range === 'month' && `📅 ${t('hr_reports.range.month')}`}
                  {range === 'quarter' && `📊 ${t('hr_reports.range.quarter')}`}
                  {range === 'year' && `📈 ${t('hr_reports.range.year')}`}
                  {range === 'custom' && `⚙️ ${t('hr_reports.range.custom')}`}
                </button>
              ))}
            </div>
          </div>

          {dateRange === 'custom' && (
            <div className="custom-dates">
              <input
                type="date"
                value={customDateRange.start}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="date-input"
              />
              <span className="date-separator">{t('hr_reports.to')}</span>
              <input
                type="date"
                value={customDateRange.end}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="date-input"
              />
              <button 
                onClick={() => loadReportData(customDateRange.start, customDateRange.end)}
                className="btn-apply-dates"
              >
                {t('hr_reports.apply')}
              </button>
            </div>
          )}
        </div>

        <div className="controls-row">
          <div className="filter-group">
            <label>{t('hr_reports.department')}</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="filter-select"
            >
              {departmentOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>{t('hr_reports.status_filter')}</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="filter-select"
            >
              <option value="all">{t('hr_reports.status.all')}</option>
              <option value="approved">{t('hr_reports.status.approved')}</option>
              <option value="pending">{t('hr_reports.status.pending')}</option>
              <option value="rejected">{t('hr_reports.status.rejected')}</option>
            </select>
          </div>

          <div className="refresh-group">
            <button 
              onClick={() => loadReportData()} 
              className="btn-refresh"
              title={t('hr_reports.refresh_title')}
            >
              🔄 {t('hr_reports.refresh')}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="hr-tabs">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 {t('hr_reports.tabs.overview')}
        </button>
        <button
          className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          📈 {t('hr_reports.tabs.analytics')}
        </button>
        <button
          className={`tab-btn ${activeTab === 'compliance' ? 'active' : ''}`}
          onClick={() => setActiveTab('compliance')}
        >
          ⚖️ {t('hr_reports.tabs.compliance')}
        </button>
        <button
          className={`tab-btn ${activeTab === 'employees' ? 'active' : ''}`}
          onClick={() => setActiveTab('employees')}
        >
          👥 {t('hr_reports.tabs.employees')}
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && filteredData && (
        <div className="overview-tab">
          {/* Key Metrics */}
          <div className="metrics-grid">
            {[
              {
                title: t('hr_reports.metrics.total_employees'),
                value: formatNumber(filteredData.summary?.totalEmployees),
                icon: '👥',
                color: 'primary',
                change: growthMetrics ? t('hr_reports.metrics.change_from_last_period', { value: growthMetrics.totalLeaves?.growth?.toFixed(1) || 0 }) : undefined
              },
              {
                title: t('hr_reports.metrics.total_leaves'),
                value: formatNumber(filteredData.summary?.totalLeaves),
                icon: '📋',
                color: 'info',
                subtitle: t('hr_reports.metrics.total_days', { days: formatNumber(filteredData.summary?.totalLeaveDays) })
              },
              {
                title: t('hr_reports.metrics.approval_rate'),
                value: formatPercentage(
                  filteredData.summary?.totalLeaves && filteredData.summary?.totalLeaves > 0 
                    ? (filteredData.summary.approvedLeaves / filteredData.summary.totalLeaves) * 100 
                    : 0
                ),
                icon: '✅',
                color: 'success',
                change: growthMetrics ? t('hr_reports.metrics.change', { value: growthMetrics.approvalRate?.growth?.toFixed(1) || 0 }) : undefined
              },
              {
                title: t('hr_reports.metrics.on_leave_today'),
                value: formatNumber(filteredData.summary?.onLeaveToday),
                icon: '🏖️',
                color: 'warning',
                subtitle: filteredData.summary?.totalEmployees && filteredData.summary?.onLeaveToday 
                  ? t('hr_reports.metrics.workforce_pct', { value: ((filteredData.summary.onLeaveToday / filteredData.summary.totalEmployees) * 100).toFixed(1) })
                  : t('common.na')
              },
              {
                title: t('hr_reports.metrics.pending_approvals'),
                value: formatNumber(filteredData.summary?.pendingApprovals),
                icon: '⏳',
                color: 'warning',
                subtitle: t('hr_reports.metrics.requires_attention')
              },
              {
                title: t('hr_reports.metrics.avg_leave_duration'),
                value: t('hr_reports.metrics.avg_duration_value', { days: filteredData.summary?.averageLeaveDuration?.toFixed(1) || 0 }),
                icon: '📅',
                color: 'accent',
                change: growthMetrics ? t('hr_reports.metrics.change', { value: growthMetrics.averageDuration?.growth?.toFixed(1) || 0 }) : undefined
              }
            ].map((metric, index) => (
              <div key={index} className={`metric-card ${metric.color}`}>
                <div className="metric-icon">{metric.icon}</div>
                <div className="metric-content">
                  <div className="metric-value">{metric.value}</div>
                  <div className="metric-label">{metric.title}</div>
                  {metric.subtitle && (
                    <div className="metric-subtitle">{metric.subtitle}</div>
                  )}
                  {metric.change && growthMetrics && (
                    <div className="metric-change">
                      <span className={`trend-${growthMetrics.totalLeaves?.trend || 'neutral'}`}>
                        {getTrendIcon((growthMetrics.totalLeaves?.trend || 'neutral') as 'up' | 'down' | 'neutral', growthMetrics.totalLeaves?.growth || 0)}
                      </span>
                      {metric.change}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Department Performance */}
          <div className="performance-section">
            <h3>🏢 {t('hr_reports.department_performance')}</h3>
            <div className="department-performance">
              {filteredData.departmentStats?.map((dept, index) => (
                <div key={index} className="dept-performance-card">
                  <div className="dept-header">
                    <h4>{dept.department}</h4>
                    <span className="dept-employee-count">{t('hr_reports.department_employees', { count: dept.employeeCount })}</span>
                  </div>
                  <div className="dept-metrics">
                    <div className="dept-metric">
                      <span className="metric-label">{t('hr_reports.department.leaves')}</span>
                      <span className="metric-value">{dept.totalLeaves}</span>
                    </div>
                    <div className="dept-metric">
                      <span className="metric-label">{t('hr_reports.department.approval_rate')}</span>
                      <span className={`metric-value ${dept.approvalRate >= 80 ? 'high' : dept.approvalRate >= 60 ? 'medium' : 'low'}`}>
                        {dept.approvalRate?.toFixed(1)}%
                      </span>
                    </div>
                    <div className="dept-metric">
                      <span className="metric-label">{t('hr_reports.department.avg_duration')}</span>
                      <span className="metric-value">{t('hr_reports.department.avg_duration_value', { days: dept.averageDuration?.toFixed(1) || 0 })}</span>
                    </div>
                  </div>
                  <div className="dept-progress">
                    <div 
                      className="progress-bar" 
                      style={{ width: `${dept.approvalRate || 0}%` }}
                    ></div>
                  </div>
                </div>
              )) || (
                <div className="no-department-data">
                  <p>{t('hr_reports.no_department_data')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && filteredData && (
        <div className="analytics-tab">
          {/* Charts Section */}
          <div className="charts-grid">
            {/* Monthly Trends */}
            <div className="chart-card">
              <div className="chart-header">
                <h4>📅 {t('hr_reports.monthly_trends')}</h4>
                <span className="chart-subtitle">{t('hr_reports.last_6_months')}</span>
              </div>
              <div className="chart-container">
                <div className="trend-chart">
                  {filteredData.monthlyTrends?.map((month, index) => (
                    <div key={index} className="trend-bar-group">
                      <div className="trend-bar-container">
                        <div 
                          className="trend-bar leaves" 
                          style={{ height: `${((month.leavesTaken || 0) / 50) * 100}%` }}
                          title={t('hr_reports.trend_tooltip', { count: month.leavesTaken || 0 })}
                        ></div>
                      </div>
                      <div className="trend-label">{month.month}</div>
                      <div className="trend-rate">
                        {(month.approvalRate || 0).toFixed(0)}%
                      </div>
                    </div>
                  )) || (
                    <div className="no-trend-data">
                      <p>{t('hr_reports.no_trend_data')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Leave Type Distribution */}
            <div className="chart-card">
              <div className="chart-header">
                <h4>🏷️ {t('hr_reports.leave_type_distribution')}</h4>
                <span className="chart-subtitle">{t('hr_reports.most_used_types')}</span>
              </div>
              <div className="donut-chart-container">
                {filteredData.leaveTypeStats && filteredData.leaveTypeStats.length > 0 ? (
                  <>
                    <div className="donut-chart">
                      {filteredData.leaveTypeStats.map((type, index, array) => {
                        const total = array.reduce((sum, t) => sum + (t.totalRequests || 0), 0);
                        const percentage = total > 0 ? ((type.totalRequests || 0) / total) * 100 : 0;
                        const rotation = array.slice(0, index).reduce((sum, t) => 
                          sum + ((t.totalRequests || 0) / total) * 360, 0
                        );
                        
                        return (
                          <div 
                            key={index}
                            className="donut-segment"
                            style={{
                              background: `conic-gradient(
                                var(--segment-color-${index}) 0deg,
                                var(--segment-color-${index}) ${percentage * 3.6}deg,
                                transparent ${percentage * 3.6}deg,
                                transparent 360deg
                              )`,
                              transform: `rotate(${rotation}deg)`
                            }}
                          ></div>
                        );
                      })}
                    </div>
                    <div className="donut-legend">
                      {filteredData.leaveTypeStats.slice(0, 5).map((type, index) => (
                        <div key={index} className="legend-item">
                          <span className="legend-color"></span>
                          <span className="legend-label">{type.leaveType}</span>
                          <span className="legend-value">{type.totalRequests || 0}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="no-chart-data">
                    <p>{t('hr_reports.no_leave_type_data')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Detailed Analytics */}
          <div className="analytics-details">
            <div className="analytics-section">
              <h4>📊 {t('hr_reports.leave_type_analytics')}</h4>
              {filteredData.leaveTypeStats && filteredData.leaveTypeStats.length > 0 ? (
                <div className="analytics-table">
                  <table>
                    <thead>
                      <tr>
                        <th>{t('hr_reports.table.leave_type')}</th>
                        <th>{t('hr_reports.table.total_requests')}</th>
                        <th>{t('hr_reports.table.approved')}</th>
                        <th>{t('hr_reports.table.approval_rate')}</th>
                        <th>{t('hr_reports.table.avg_duration')}</th>
                        <th>{t('hr_reports.table.utilization')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.leaveTypeStats.map((type, index) => {
                        const approvalRate = type.totalRequests && type.totalRequests > 0 
                          ? (type.approvedRequests || 0) / type.totalRequests * 100 
                          : 0;
                        
                        return (
                          <tr key={index}>
                            <td>{type.leaveType}</td>
                            <td>{type.totalRequests || 0}</td>
                            <td>{type.approvedRequests || 0}</td>
                            <td>
                              <div className="rate-cell">
                                <div className="rate-bar">
                                  <div 
                                    className="rate-fill"
                                    style={{ width: `${approvalRate}%` }}
                                  ></div>
                                </div>
                                <span>{approvalRate.toFixed(1)}%</span>
                              </div>
                            </td>
                            <td>{t('hr_reports.table.avg_duration_value', { days: (type.averageDuration || 0).toFixed(1) })}</td>
                            <td>{(type.utilizationRate || 0).toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="no-table-data">
                  <p>{t('hr_reports.no_leave_type_analytics')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Compliance Tab */}
      {activeTab === 'compliance' && filteredData && (
        <div className="compliance-tab">
          {/* Compliance Score */}
          <div className="compliance-score-card">
            <div className="score-header">
              <h3>⚖️ {t('hr_reports.compliance.score')}</h3>
              <span className="score-level">{getComplianceLevel(complianceScore)}</span>
            </div>
            <div className="score-display">
              <div className="score-circle" style={{ '--score': complianceScore } as any}>
                <div className="score-value">{complianceScore.toFixed(0)}</div>
                <div className="score-label">{t('hr_reports.compliance.score_label')}</div>
              </div>
              <div className="score-breakdown">
                {[
                  { label: t('hr_reports.compliance.policy_violations'), value: filteredData.complianceData?.policyViolations || 0, weight: 2 },
                  { label: t('hr_reports.compliance.late_applications'), value: filteredData.complianceData?.lateApplications || 0, weight: 1 },
                  { label: t('hr_reports.compliance.overlapping_leaves'), value: filteredData.complianceData?.overlappingLeaves || 0, weight: 3 },
                  { label: t('hr_reports.compliance.high_frequency'), value: filteredData.complianceData?.highFrequencyEmployees || 0, weight: 2 }
                ].map((item, index) => (
                  <div key={index} className="breakdown-item">
                    <span className="breakdown-label">{item.label}</span>
                    <span className="breakdown-value">{t('hr_reports.compliance.weighted', { value: item.value, weight: item.weight })}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Compliance Details */}
          <div className="compliance-details">
            <h4>📋 {t('hr_reports.compliance.details')}</h4>
            <div className="compliance-grid">
              <div className="compliance-item critical">
                <div className="compliance-icon">🚨</div>
                <div className="compliance-content">
                  <h5>{t('hr_reports.compliance.policy_violations')}</h5>
                  <p>{t('hr_reports.compliance.violations_detected', { count: filteredData.complianceData?.policyViolations || 0 })}</p>
                  <small>{t('hr_reports.compliance.policy_violations_desc')}</small>
                </div>
              </div>
              <div className="compliance-item warning">
                <div className="compliance-icon">⏰</div>
                <div className="compliance-content">
                  <h5>{t('hr_reports.compliance.late_applications')}</h5>
                  <p>{t('hr_reports.compliance.late_submissions', { count: filteredData.complianceData?.lateApplications || 0 })}</p>
                  <small>{t('hr_reports.compliance.late_applications_desc')}</small>
                </div>
              </div>
              <div className="compliance-item info">
                <div className="compliance-icon">📅</div>
                <div className="compliance-content">
                  <h5>{t('hr_reports.compliance.overlapping_leaves')}</h5>
                  <p>{t('hr_reports.compliance.overlaps_detected', { count: filteredData.complianceData?.overlappingLeaves || 0 })}</p>
                  <small>{t('hr_reports.compliance.overlapping_leaves_desc')}</small>
                </div>
              </div>
              <div className="compliance-item success">
                <div className="compliance-icon">👤</div>
                <div className="compliance-content">
                  <h5>{t('hr_reports.compliance.high_frequency')}</h5>
                  <p>{t('hr_reports.compliance.employees_flagged', { count: filteredData.complianceData?.highFrequencyEmployees || 0 })}</p>
                  <small>{t('hr_reports.compliance.high_frequency_desc')}</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Employees Tab */}
      {activeTab === 'employees' && filteredData && (
        <div className="employees-tab">
          {/* Top Employees */}
          <div className="top-employees-section">
            <h3>🏆 {t('hr_reports.top_employees')}</h3>
            {filteredData.employeeInsights && filteredData.employeeInsights.length > 0 ? (
              <div className="employees-table">
                <table>
                  <thead>
                    <tr>
                      <th>{t('hr_reports.table.rank')}</th>
                      <th>{t('hr_reports.table.employee')}</th>
                      <th>{t('hr_reports.table.department')}</th>
                      <th>{t('hr_reports.table.leaves_taken')}</th>
                      <th>{t('hr_reports.table.total_days')}</th>
                      <th>{t('hr_reports.table.approval_rate')}</th>
                      <th>{t('hr_reports.table.trend')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.employeeInsights.slice(0, 10).map((emp, index) => (
                      <tr key={index}>
                        <td className="rank-cell">
                          <span className={`rank-badge rank-${index + 1}`}>
                            #{index + 1}
                          </span>
                        </td>
                        <td className="employee-cell">
                          <div className="employee-avatar">
                            {emp.employeeName?.split(' ').map(n => n[0]).join('') || '??'}
                          </div>
                          <div className="employee-info">
                            <strong>{emp.employeeName || t('common.unknown')}</strong>
                            <small>{emp.department || t('common.na')}</small>
                          </div>
                        </td>
                        <td>{emp.department || t('common.na')}</td>
                        <td>{emp.leavesTaken || 0}</td>
                        <td>
                          <span className="days-badge">{t('hr_reports.days_badge', { days: emp.totalDays || 0 })}</span>
                        </td>
                        <td>
                          <div className="approval-cell">
                            <div className="approval-bar">
                              <div 
                                className="approval-fill"
                                style={{ width: `${emp.approvalRate || 0}%` }}
                              ></div>
                            </div>
                            <span>{(emp.approvalRate || 0).toFixed(1)}%</span>
                          </div>
                        </td>
                        <td>
                          <span className={`trend-icon ${(emp.approvalRate || 0) >= 80 ? 'up' : (emp.approvalRate || 0) >= 60 ? 'stable' : 'down'}`}>
                            {(emp.approvalRate || 0) >= 80 ? '📈' : (emp.approvalRate || 0) >= 60 ? '➖' : '📉'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="no-employee-data">
                <p>{t('hr_reports.no_employee_data')}</p>
              </div>
            )}
          </div>

          {/* Employee Insights */}
          <div className="employee-insights">
            <h4>💡 {t('hr_reports.employee_insights')}</h4>
            <div className="insights-grid">
              {[
                {
                  title: t('hr_reports.insights.most_active_department'),
                  value: filteredData.departmentStats?.sort((a, b) => (b.totalLeaves || 0) - (a.totalLeaves || 0))[0]?.department || t('common.na'),
                  description: t('hr_reports.insights.most_active_department_desc')
                },
                {
                  title: t('hr_reports.insights.highest_approval_rate'),
                  value: filteredData.departmentStats?.sort((a, b) => (b.approvalRate || 0) - (a.approvalRate || 0))[0]?.department || t('common.na'),
                  description: t('hr_reports.insights.highest_approval_rate_desc')
                },
                {
                  title: t('hr_reports.insights.top_leave_taker'),
                  value: filteredData.employeeInsights?.[0]?.employeeName || t('common.na'),
                  description: t('hr_reports.insights.top_leave_taker_desc', { days: filteredData.employeeInsights?.[0]?.totalDays || 0 })
                },
                {
                  title: t('hr_reports.insights.most_used_leave_type'),
                  value: filteredData.leaveTypeStats?.sort((a, b) => (b.totalRequests || 0) - (a.totalRequests || 0))[0]?.leaveType || t('common.na'),
                  description: t('hr_reports.insights.most_used_leave_type_desc')
                }
              ].map((insight, index) => (
                <div key={index} className="insight-card">
                  <h5>{insight.title}</h5>
                  <div className="insight-value">{insight.value}</div>
                  <p>{insight.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HRReports;
