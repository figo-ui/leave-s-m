import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../utils/api';
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

interface ExportOptions {
  format: 'csv' | 'pdf' | 'excel';
  include: ('summary' | 'details' | 'analytics')[];
  dateRange: {
    start: string;
    end: string;
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
  const { user } = useAuth();
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
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'csv',
    include: ['summary', 'details'],
    dateRange: {
      start: customDateRange.start,
      end: customDateRange.end
    }
  });
  const [filterType, setFilterType] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');

  // Memoized calculations with null checks
  const departmentOptions = useMemo(() => {
    if (!reportData?.departmentStats) return [];
    return [
      { value: 'all', label: 'All Departments' },
      ...reportData.departmentStats.map(dept => ({
        value: dept.department,
        label: `${dept.department} (${dept.employeeCount} employees)`
      }))
    ];
  }, [reportData]);

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
        throw new Error(response.message || 'Failed to load HR report data');
      }
    } catch (error: any) {
      console.error('Error loading HR report data:', error);
      setError(error.message || 'Failed to load HR report data');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, []);

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
    
    let startDate: Date, endDate = new Date();
    
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
      alert('No data to export');
      return;
    }

    try {
      setExporting(true);
      
      // Mock export for now - implement actual API call
      const data = reportData;
      if (format === 'csv') {
        exportToCSV(data);
      } else if (format === 'pdf') {
        generatePDF(data);
      } else {
        exportToExcel(data);
      }
    } catch (error: any) {
      console.error('Export error:', error);
      alert(`Export failed: ${error.message}`);
    } finally {
      setExporting(false);
    }
  }, [reportData]);

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

  const generatePDF = (data: any) => {
    alert('PDF export feature will be implemented soon');
  };

  const exportToExcel = (data: any) => {
    alert('Excel export feature will be implemented soon');
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
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }, []);

  const getTrendIcon = useCallback((trend: 'up' | 'down' | 'neutral', value: number) => {
    if (trend === 'up') {
      return value >= 0 ? '📈' : '📉';
    }
    return value >= 0 ? '📉' : '📈';
  }, []);

  const getComplianceLevel = useCallback((score: number): string => {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Improvement';
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="hr-reports">
        <div className="page-header">
          <h1>HR Analytics & Reports</h1>
          <p>Comprehensive organizational leave analytics and insights</p>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading HR analytics data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !reportData) {
    return (
      <div className="hr-reports">
        <div className="page-header">
          <h1>HR Analytics & Reports</h1>
          <p>Comprehensive organizational leave analytics and insights</p>
        </div>
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h3>Unable to Load HR Reports</h3>
          <p>{error}</p>
          <button onClick={() => loadReportData()} className="btn-primary">
            Try Again
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
          <h1>HR Analytics & Reports</h1>
          <p>Comprehensive organizational leave analytics and insights</p>
        </div>
        <div className="no-data-state">
          <div className="no-data-icon">📊</div>
          <h3>No Report Data Available</h3>
          <p>No HR analytics data was loaded. Please try refreshing or contact support.</p>
          <button onClick={() => loadReportData()} className="btn-primary">
            Load Data
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
            <h1>HR Analytics & Reports</h1>
            <p>Comprehensive organizational leave analytics and insights</p>
            <div className="header-subtitle">
              <span className="period-info">
                Period: {formatDate(reportData.reportPeriod?.startDate)} - {formatDate(reportData.reportPeriod?.endDate)}
              </span>
              <span className="employee-count">
                📊 {formatNumber(reportData.summary?.totalEmployees)} Total Employees
              </span>
            </div>
          </div>
          
          <div className="header-actions">
            <div className="export-dropdown">
              <button className="btn-export" disabled={exporting}>
                {exporting ? 'Exporting...' : '📥 Export Report'}
              </button>
              <div className="export-menu">
                <button onClick={() => handleExport('csv')} className="export-option">
                  📄 Export as CSV
                </button>
                <button onClick={() => handleExport('pdf')} className="export-option">
                  📊 Export as PDF
                </button>
                <button onClick={() => handleExport('excel')} className="export-option">
                  📈 Export as Excel
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
            <label>Date Range:</label>
            <div className="date-range-buttons">
              {(['month', 'quarter', 'year', 'custom'] as const).map(range => (
                <button
                  key={range}
                  className={`range-btn ${dateRange === range ? 'active' : ''}`}
                  onClick={() => handleDateRangeChange(range)}
                >
                  {range === 'month' && '📅 Month'}
                  {range === 'quarter' && '📊 Quarter'}
                  {range === 'year' && '📈 Year'}
                  {range === 'custom' && '⚙️ Custom'}
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
              <span className="date-separator">to</span>
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
                Apply
              </button>
            </div>
          )}
        </div>

        <div className="controls-row">
          <div className="filter-group">
            <label>Department:</label>
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
            <label>Status Filter:</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="filter-select"
            >
              <option value="all">All Statuses</option>
              <option value="approved">Approved Only</option>
              <option value="pending">Pending Only</option>
              <option value="rejected">Rejected Only</option>
            </select>
          </div>

          <div className="refresh-group">
            <button 
              onClick={() => loadReportData()} 
              className="btn-refresh"
              title="Refresh data"
            >
              🔄 Refresh
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
          📊 Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          📈 Analytics
        </button>
        <button
          className={`tab-btn ${activeTab === 'compliance' ? 'active' : ''}`}
          onClick={() => setActiveTab('compliance')}
        >
          ⚖️ Compliance
        </button>
        <button
          className={`tab-btn ${activeTab === 'employees' ? 'active' : ''}`}
          onClick={() => setActiveTab('employees')}
        >
          👥 Employees
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && filteredData && (
        <div className="overview-tab">
          {/* Key Metrics */}
          <div className="metrics-grid">
            {[
              {
                title: 'Total Employees',
                value: formatNumber(filteredData.summary?.totalEmployees),
                icon: '👥',
                color: 'primary',
                change: growthMetrics ? `${growthMetrics.totalLeaves?.growth?.toFixed(1) || 0}% from last period` : undefined
              },
              {
                title: 'Total Leaves',
                value: formatNumber(filteredData.summary?.totalLeaves),
                icon: '📋',
                color: 'info',
                subtitle: `${formatNumber(filteredData.summary?.totalLeaveDays)} total days`
              },
              {
                title: 'Approval Rate',
                value: formatPercentage(
                  filteredData.summary?.totalLeaves && filteredData.summary?.totalLeaves > 0 
                    ? (filteredData.summary.approvedLeaves / filteredData.summary.totalLeaves) * 100 
                    : 0
                ),
                icon: '✅',
                color: 'success',
                change: growthMetrics ? `${growthMetrics.approvalRate?.growth?.toFixed(1) || 0}% change` : undefined
              },
              {
                title: 'On Leave Today',
                value: formatNumber(filteredData.summary?.onLeaveToday),
                icon: '🏖️',
                color: 'warning',
                subtitle: filteredData.summary?.totalEmployees && filteredData.summary?.onLeaveToday 
                  ? `${((filteredData.summary.onLeaveToday / filteredData.summary.totalEmployees) * 100).toFixed(1)}% of workforce`
                  : 'N/A'
              },
              {
                title: 'Pending Approvals',
                value: formatNumber(filteredData.summary?.pendingApprovals),
                icon: '⏳',
                color: 'warning',
                subtitle: 'Requires attention'
              },
              {
                title: 'Avg Leave Duration',
                value: `${filteredData.summary?.averageLeaveDuration?.toFixed(1) || 0} days`,
                icon: '📅',
                color: 'accent',
                change: growthMetrics ? `${growthMetrics.averageDuration?.growth?.toFixed(1) || 0}% change` : undefined
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
                        {getTrendIcon(growthMetrics.totalLeaves?.trend || 'neutral', growthMetrics.totalLeaves?.growth || 0)}
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
            <h3>🏢 Department Performance</h3>
            <div className="department-performance">
              {filteredData.departmentStats?.map((dept, index) => (
                <div key={index} className="dept-performance-card">
                  <div className="dept-header">
                    <h4>{dept.department}</h4>
                    <span className="dept-employee-count">{dept.employeeCount} employees</span>
                  </div>
                  <div className="dept-metrics">
                    <div className="dept-metric">
                      <span className="metric-label">Leaves</span>
                      <span className="metric-value">{dept.totalLeaves}</span>
                    </div>
                    <div className="dept-metric">
                      <span className="metric-label">Approval Rate</span>
                      <span className={`metric-value ${dept.approvalRate >= 80 ? 'high' : dept.approvalRate >= 60 ? 'medium' : 'low'}`}>
                        {dept.approvalRate?.toFixed(1)}%
                      </span>
                    </div>
                    <div className="dept-metric">
                      <span className="metric-label">Avg Duration</span>
                      <span className="metric-value">{dept.averageDuration?.toFixed(1) || 0}d</span>
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
                  <p>No department data available</p>
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
                <h4>📅 Monthly Leave Trends</h4>
                <span className="chart-subtitle">Last 6 months overview</span>
              </div>
              <div className="chart-container">
                <div className="trend-chart">
                  {filteredData.monthlyTrends?.map((month, index) => (
                    <div key={index} className="trend-bar-group">
                      <div className="trend-bar-container">
                        <div 
                          className="trend-bar leaves" 
                          style={{ height: `${((month.leavesTaken || 0) / 50) * 100}%` }}
                          title={`${month.leavesTaken || 0} leaves`}
                        ></div>
                      </div>
                      <div className="trend-label">{month.month}</div>
                      <div className="trend-rate">
                        {(month.approvalRate || 0).toFixed(0)}%
                      </div>
                    </div>
                  )) || (
                    <div className="no-trend-data">
                      <p>No trend data available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Leave Type Distribution */}
            <div className="chart-card">
              <div className="chart-header">
                <h4>🏷️ Leave Type Distribution</h4>
                <span className="chart-subtitle">Most used leave types</span>
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
                    <p>No leave type data available</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Detailed Analytics */}
          <div className="analytics-details">
            <div className="analytics-section">
              <h4>📊 Leave Type Analytics</h4>
              {filteredData.leaveTypeStats && filteredData.leaveTypeStats.length > 0 ? (
                <div className="analytics-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Leave Type</th>
                        <th>Total Requests</th>
                        <th>Approved</th>
                        <th>Approval Rate</th>
                        <th>Avg Duration</th>
                        <th>Utilization</th>
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
                            <td>{(type.averageDuration || 0).toFixed(1)} days</td>
                            <td>{(type.utilizationRate || 0).toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="no-table-data">
                  <p>No leave type analytics data available</p>
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
              <h3>⚖️ Compliance Score</h3>
              <span className="score-level">{getComplianceLevel(complianceScore)}</span>
            </div>
            <div className="score-display">
              <div className="score-circle" style={{ '--score': complianceScore } as any}>
                <div className="score-value">{complianceScore.toFixed(0)}</div>
                <div className="score-label">Score</div>
              </div>
              <div className="score-breakdown">
                {[
                  { label: 'Policy Violations', value: filteredData.complianceData?.policyViolations || 0, weight: 2 },
                  { label: 'Late Applications', value: filteredData.complianceData?.lateApplications || 0, weight: 1 },
                  { label: 'Overlapping Leaves', value: filteredData.complianceData?.overlappingLeaves || 0, weight: 3 },
                  { label: 'High Frequency', value: filteredData.complianceData?.highFrequencyEmployees || 0, weight: 2 }
                ].map((item, index) => (
                  <div key={index} className="breakdown-item">
                    <span className="breakdown-label">{item.label}</span>
                    <span className="breakdown-value">{item.value} × {item.weight}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Compliance Details */}
          <div className="compliance-details">
            <h4>📋 Compliance Details</h4>
            <div className="compliance-grid">
              <div className="compliance-item critical">
                <div className="compliance-icon">🚨</div>
                <div className="compliance-content">
                  <h5>Policy Violations</h5>
                  <p>{(filteredData.complianceData?.policyViolations || 0)} violations detected</p>
                  <small>Includes leaves exceeding limits, unauthorized types</small>
                </div>
              </div>
              <div className="compliance-item warning">
                <div className="compliance-icon">⏰</div>
                <div className="compliance-content">
                  <h5>Late Applications</h5>
                  <p>{(filteredData.complianceData?.lateApplications || 0)} late submissions</p>
                  <small>Applications submitted with insufficient notice</small>
                </div>
              </div>
              <div className="compliance-item info">
                <div className="compliance-icon">📅</div>
                <div className="compliance-content">
                  <h5>Overlapping Leaves</h5>
                  <p>{(filteredData.complianceData?.overlappingLeaves || 0)} overlaps detected</p>
                  <small>Multiple approved leaves for same period</small>
                </div>
              </div>
              <div className="compliance-item success">
                <div className="compliance-icon">👤</div>
                <div className="compliance-content">
                  <h5>High Frequency Employees</h5>
                  <p>{(filteredData.complianceData?.highFrequencyEmployees || 0)} employees flagged</p>
                  <small>Employees with excessive leave frequency</small>
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
            <h3>🏆 Top 10 Employees by Leave Days</h3>
            {filteredData.employeeInsights && filteredData.employeeInsights.length > 0 ? (
              <div className="employees-table">
                <table>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Leaves Taken</th>
                      <th>Total Days</th>
                      <th>Approval Rate</th>
                      <th>Trend</th>
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
                            <strong>{emp.employeeName || 'Unknown'}</strong>
                            <small>{emp.department || 'N/A'}</small>
                          </div>
                        </td>
                        <td>{emp.department || 'N/A'}</td>
                        <td>{emp.leavesTaken || 0}</td>
                        <td>
                          <span className="days-badge">{emp.totalDays || 0} days</span>
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
                <p>No employee insights data available</p>
              </div>
            )}
          </div>

          {/* Employee Insights */}
          <div className="employee-insights">
            <h4>💡 Employee Insights</h4>
            <div className="insights-grid">
              {[
                {
                  title: 'Most Active Department',
                  value: filteredData.departmentStats?.sort((a, b) => (b.totalLeaves || 0) - (a.totalLeaves || 0))[0]?.department || 'N/A',
                  description: 'Highest number of leave requests'
                },
                {
                  title: 'Highest Approval Rate',
                  value: filteredData.departmentStats?.sort((a, b) => (b.approvalRate || 0) - (a.approvalRate || 0))[0]?.department || 'N/A',
                  description: 'Most efficient approval process'
                },
                {
                  title: 'Top Leave Taker',
                  value: filteredData.employeeInsights?.[0]?.employeeName || 'N/A',
                  description: `${filteredData.employeeInsights?.[0]?.totalDays || 0} total leave days`
                },
                {
                  title: 'Most Used Leave Type',
                  value: filteredData.leaveTypeStats?.sort((a, b) => (b.totalRequests || 0) - (a.totalRequests || 0))[0]?.leaveType || 'N/A',
                  description: 'Most frequently requested leave type'
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