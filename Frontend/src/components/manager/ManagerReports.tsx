// components/ManagerReports.tsx
import React, { useState, useEffect } from 'react';
import { apiService } from '../../utils/api';
import type{ Leave, LeaveType, TeamMember } from '../../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { useTranslation } from 'react-i18next';
import './ManagerReports.css';

interface ReportData {
  dateRange: {
    start: string;
    end: string;
  };
  summary: {
    totalApplications: number;
    approved: number;
    rejected: number;
    pending: number;
    approvalRate: number;
    averageProcessingTime: number;
  };
  byMonth: Array<{
    month: string;
    applications: number;
    approved: number;
    rejected: number;
  }>;
  byDepartment: Array<{
    department: string;
    applications: number;
    approvalRate: number;
  }>;
  byLeaveType: Array<{
    leaveType: string;
    count: number;
    avgDuration: number;
    color: string;
  }>;
  teamPerformance: Array<{
    employee: string;
    applications: number;
    approvalRate: number;
    avgLeaveDuration: number;
  }>;
  peakLeavePeriods: Array<{
    period: string;
    leaveCount: number;
    department: string;
  }>;
  leaveTrends: Array<{
    month: string;
    applications: number;
    avgProcessingTime: number;
  }>;
}

interface FilterOptions {
  startDate: string;
  endDate: string;
  department: string;
  leaveType: string;
  employee: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const ManagerReports: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState<boolean>(true);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [exporting, setExporting] = useState<boolean>(false);

  const [filters, setFilters] = useState<FilterOptions>({
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 90 days
    endDate: new Date().toISOString().split('T')[0],
    department: 'all',
    leaveType: 'all',
    employee: 'all'
  });

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Load report when filters change
  useEffect(() => {
    if (teamMembers.length > 0) {
      loadReportData();
    }
  }, [filters]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load team members
      const teamResponse = await apiService.getManagerTeamOverview();
      if (teamResponse.success && teamResponse.data) {
        const members = teamResponse.data;
        setTeamMembers(members);
        
        // Extract unique departments
        const uniqueDepts = Array.from(new Set(members.map(m => m.department || 'Unassigned'))).sort();
        setDepartments(['all', ...uniqueDepts]);
      }

      // Load leave types
      const typesResponse = await apiService.getLeaveTypes();
      if (typesResponse.success && typesResponse.data) {
        setLeaveTypes(typesResponse.data);
      }

    } catch (error: any) {
      console.error('Error loading initial data:', error);
      setError('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const loadReportData = async () => {
    try {
      setLoading(true);
      
      // Get leaves for the team
      const leavesResponse = await apiService.getLeaveHistory(1000); // Get large number of leaves
      if (!leavesResponse.success || !leavesResponse.data) {
        throw new Error('Failed to load leave data');
      }

      const allLeaves = leavesResponse.data as Leave[];
      
      // Filter leaves based on current filters
      const filteredLeaves = filterLeaves(allLeaves);
      
      // Generate report data
      const report = generateReportData(filteredLeaves);
      setReportData(report);

    } catch (error: any) {
      console.error('Error loading report data:', error);
      setError(error.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const filterLeaves = (leaves: Leave[]): Leave[] => {
    const startDate = new Date(filters.startDate);
    const endDate = new Date(filters.endDate);
    
    return leaves.filter(leave => {
      // Date filter
      const leaveDate = new Date(leave.appliedDate);
      if (leaveDate < startDate || leaveDate > endDate) return false;

      // Department filter
      if (filters.department !== 'all' && leave.employee?.department !== filters.department) {
        return false;
      }

      // Leave type filter
      if (filters.leaveType !== 'all' && (leave.leaveTypeId?.toString() || '') !== filters.leaveType) {
        return false;
      }

      // Employee filter
      if (filters.employee !== 'all' && (leave.employeeId?.toString() || '') !== filters.employee) {
        return false;
      }

      // Only include team members' leaves
      const isTeamMember = teamMembers.some(member => member.id === leave.employeeId);
      return isTeamMember;
    });
  };

  const generateReportData = (leaves: Leave[]): ReportData => {
    // Summary calculations
    const totalApplications = leaves.length;
    const approved = leaves.filter(l => l.status === 'APPROVED' || l.status === 'HR_APPROVED').length;
    const rejected = leaves.filter(l => l.status === 'REJECTED').length;
    const pending = leaves.filter(l => l.status === 'PENDING_MANAGER' || l.status === 'PENDING_HR').length;
    const approvalRate = totalApplications > 0 ? Math.round((approved / totalApplications) * 100) : 0;

    // Calculate average processing time
    const processedLeaves = leaves.filter(l => 
      (l.status === 'APPROVED' || l.status === 'HR_APPROVED' || l.status === 'REJECTED') &&
      l.appliedDate && (l.managerApprovedDate || l.hrApprovedDate)
    );

    let totalProcessingTime = 0;
    processedLeaves.forEach(leave => {
      const appliedDate = new Date(leave.appliedDate);
      const processedDate = new Date(leave.managerApprovedDate || leave.hrApprovedDate || leave.appliedDate);
      const diffHours = Math.abs(processedDate.getTime() - appliedDate.getTime()) / (1000 * 60 * 60 * 24);
      totalProcessingTime += diffHours;
    });

    const averageProcessingTime = processedLeaves.length > 0 
      ? Math.round(totalProcessingTime / processedLeaves.length * 10) / 10 
      : 0;

    // Group by month
    const byMonth = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      const monthLeaves = leaves.filter(l => {
        const leaveDate = new Date(l.appliedDate);
        return leaveDate.getMonth() === date.getMonth() && 
               leaveDate.getFullYear() === date.getFullYear();
      });

      return {
        month,
        applications: monthLeaves.length,
        approved: monthLeaves.filter(l => l.status === 'APPROVED' || l.status === 'HR_APPROVED').length,
        rejected: monthLeaves.filter(l => l.status === 'REJECTED').length
      };
    }).reverse();

    // Group by department
    const byDepartment = teamMembers.map(member => {
      const department = member.department || 'Unassigned';
      const deptLeaves = leaves.filter(l => (l.employee?.department || 'Unassigned') === department);
      const deptApproved = deptLeaves.filter(l => l.status === 'APPROVED' || l.status === 'HR_APPROVED').length;
      const deptRate = deptLeaves.length > 0 ? Math.round((deptApproved / deptLeaves.length) * 100) : 0;
      
      return {
        department,
        applications: deptLeaves.length,
        approvalRate: deptRate
      };
    }).filter((dept, index, self) =>
      index === self.findIndex(d => d.department === dept.department)
    );

    // Group by leave type
    const byLeaveType = leaves.reduce((acc, leave) => {
      const typeName = typeof leave.leaveType === 'string'
        ? leave.leaveType
        : leave.leaveType?.name || 'Unknown';
      const existing = acc.find(item => item.leaveType === typeName);
      
      if (existing) {
        existing.count++;
        existing.avgDuration = ((existing.avgDuration * (existing.count - 1)) + leave.days) / existing.count;
      } else {
        const colorIndex = acc.length % COLORS.length;
        acc.push({
          leaveType: typeName,
          count: 1,
          avgDuration: leave.days,
          color: COLORS[colorIndex]
        });
      }
      
      return acc;
    }, [] as Array<{leaveType: string, count: number, avgDuration: number, color: string}>);

    // Team performance
    const teamPerformance = teamMembers.map(member => {
      const memberLeaves = leaves.filter(l => l.employeeId === member.id);
      const approvedLeaves = memberLeaves.filter(l => l.status === 'APPROVED' || l.status === 'HR_APPROVED');
      const totalDuration = memberLeaves.reduce((sum, l) => sum + l.days, 0);
      
      return {
        employee: member.name,
        applications: memberLeaves.length,
        approvalRate: memberLeaves.length > 0 ? Math.round((approvedLeaves.length / memberLeaves.length) * 100) : 0,
        avgLeaveDuration: memberLeaves.length > 0 ? Math.round((totalDuration / memberLeaves.length) * 10) / 10 : 0
      };
    }).sort((a, b) => b.approvalRate - a.approvalRate);

    // Peak leave periods (simplified - find months with highest leave counts)
    const peakLeavePeriods = byMonth
      .map(month => ({
        period: month.month,
        leaveCount: month.applications,
        department: byDepartment.length > 0 
          ? byDepartment.reduce((max, dept) => dept.applications > max.applications ? dept : max).department
          : 'N/A'
      }))
      .sort((a, b) => b.leaveCount - a.leaveCount)
      .slice(0, 3);

    // Leave trends
    const leaveTrends = byMonth.map(month => ({
      month: month.month,
      applications: month.applications,
      avgProcessingTime: averageProcessingTime // Simplified - in reality would calculate per month
    }));

    return {
      dateRange: {
        start: filters.startDate,
        end: filters.endDate
      },
      summary: {
        totalApplications,
        approved,
        rejected,
        pending,
        approvalRate,
        averageProcessingTime
      },
      byMonth,
      byDepartment,
      byLeaveType,
      teamPerformance,
      peakLeavePeriods,
      leaveTrends
    };
  };

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleExport = async (format: 'pdf' | 'excel' | 'csv') => {
    try {
      setExporting(true);
      
      // In a real implementation, you would call a backend endpoint to generate the report
      // For now, we'll simulate the export
      if (format === 'csv') {
        // Simple CSV export for demonstration
        const csvData = convertToCSV(reportData);
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `manager-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        // For PDF/Excel, you would typically use a library or backend service
        alert(`${format.toUpperCase()} export would be implemented with a proper library or backend service.`);
      }
      
    } catch (error) {
      console.error('Export error:', error);
      alert(t('manager_reports.errors.export_failed'));
    } finally {
      setExporting(false);
    }
  };

  const convertToCSV = (data: ReportData | null): string => {
    if (!data) return '';
    
    const headers = [t('manager_reports.csv.metric'), t('manager_reports.csv.value')];
    const rows = [
      [t('manager_reports.csv.total_applications'), data.summary.totalApplications.toString()],
      [t('manager_reports.csv.approved'), data.summary.approved.toString()],
      [t('manager_reports.csv.rejected'), data.summary.rejected.toString()],
      [t('manager_reports.csv.pending'), data.summary.pending.toString()],
      [t('manager_reports.csv.approval_rate'), `${data.summary.approvalRate}%`],
      [t('manager_reports.csv.avg_processing_time'), t('manager_reports.csv.avg_processing_time_value', { days: data.summary.averageProcessingTime })],
      ['', ''],
      [t('manager_reports.csv.month'), t('manager_reports.csv.applications'), t('manager_reports.csv.approved'), t('manager_reports.csv.rejected')],
      ...data.byMonth.map(m => [m.month, m.applications.toString(), m.approved.toString(), m.rejected.toString()])
    ];
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const localeMap: Record<string, string> = { en: 'en-US', am: 'am-ET', om: 'om-ET' };
    const locale = localeMap[i18n.language] || 'en-US';
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading && !reportData) {
    return (
      <div className="manager-reports">
        <div className="page-header">
          <h1>{t('manager_reports.title')}</h1>
          <p>{t('manager_reports.loading')}</p>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>{t('manager_reports.generating')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="manager-reports">
      <div className="page-header">
        <div className="header-content">
          <div className="header-title">
            <h1>📊 {t('manager_reports.title')}</h1>
            <p>{t('manager_reports.subtitle')}</p>
          </div>
          <div className="header-actions">
            <div className="export-dropdown">
              <button 
                className="export-btn"
                disabled={exporting || !reportData}
              >
                {exporting ? t('manager_reports.exporting') : `📥 ${t('manager_reports.export')}`}
              </button>
              <div className="export-options">
                <button onClick={() => handleExport('csv')} disabled={exporting}>
                  📄 CSV
                </button>
                <button onClick={() => handleExport('excel')} disabled={exporting}>
                  📊 Excel
                </button>
                <button onClick={() => handleExport('pdf')} disabled={exporting}>
                  📑 PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="error-message">
          <div className="error-content">
            <span className="error-icon">❌</span>
            {error}
          </div>
          <button onClick={() => setError('')} className="error-close" aria-label={t('common.close')}>×</button>
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-card">
          <h3>{t('manager_reports.date_range')}</h3>
          <div className="date-filters">
            <div className="date-input">
              <label>{t('manager_reports.from')}</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>
            <div className="date-input">
              <label>{t('manager_reports.to')}</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
        </div>

        <div className="filter-card">
          <h3>{t('manager_reports.filters')}</h3>
          <div className="filter-grid">
            <div className="filter-input">
              <label>{t('about_me.department')}</label>
              <select
                value={filters.department}
                onChange={(e) => handleFilterChange('department', e.target.value)}
              >
                <option value="all">{t('team_overview.filters.all_departments')}</option>
                {departments.filter(d => d !== 'all').map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div className="filter-input">
              <label>{t('apply_leave.fields.leave_type')}</label>
              <select
                value={filters.leaveType}
                onChange={(e) => handleFilterChange('leaveType', e.target.value)}
              >
                <option value="all">{t('hr_approvals.all_leave_types')}</option>
                {leaveTypes.map(type => (
                  <option key={type.id} value={type.id.toString()}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-input">
              <label>{t('about_me.full_name')}</label>
              <select
                value={filters.employee}
                onChange={(e) => handleFilterChange('employee', e.target.value)}
              >
                <option value="all">{t('manager_reports.all_employees')}</option>
                {teamMembers.map(member => (
                  <option key={member.id} value={member.id.toString()}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="filter-card">
          <h3>📈 {t('manager_reports.quick_stats.title')}</h3>
          {reportData && (
            <div className="quick-stats">
              <div className="quick-stat">
                <div className="stat-value">{reportData.summary.totalApplications}</div>
                <div className="stat-label">{t('manager_reports.quick_stats.total_applications')}</div>
              </div>
              <div className="quick-stat">
                <div className="stat-value">{reportData.summary.approvalRate}%</div>
                <div className="stat-label">{t('manager_reports.quick_stats.approval_rate')}</div>
              </div>
              <div className="quick-stat">
                <div className="stat-value">{reportData.summary.averageProcessingTime}d</div>
                <div className="stat-label">{t('manager_reports.quick_stats.avg_processing_time')}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Report Period */}
      <div className="report-period">
        <h3>
          📋 {t('manager_reports.report_period', { start: formatDate(filters.startDate), end: formatDate(filters.endDate) })}
        </h3>
        <button 
          className="refresh-btn"
          onClick={loadReportData}
          disabled={loading}
        >
          {loading ? t('manager_reports.refreshing') : t('manager_reports.refresh')}
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="report-tabs">
        <button 
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 {t('manager_reports.tabs.overview')}
        </button>
        <button 
          className={`tab-btn ${activeTab === 'performance' ? 'active' : ''}`}
          onClick={() => setActiveTab('performance')}
        >
          👥 {t('manager_reports.tabs.performance')}
        </button>
        <button 
          className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          📈 {t('manager_reports.tabs.analytics')}
        </button>
        <button 
          className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          📋 {t('manager_reports.tabs.details')}
        </button>
      </div>

      {/* Report Content */}
      {reportData && (
        <div className="report-content">
          {activeTab === 'overview' && (
            <div className="overview-tab">
              {/* Summary Cards */}
              <div className="summary-cards">
                <div className="summary-card total">
                  <div className="card-icon">📄</div>
                  <div className="card-content">
                    <div className="card-value">{reportData.summary.totalApplications}</div>
                    <div className="card-label">{t('manager_reports.summary.total_applications')}</div>
                  </div>
                </div>
                <div className="summary-card approved">
                  <div className="card-icon">✅</div>
                  <div className="card-content">
                    <div className="card-value">{reportData.summary.approved}</div>
                    <div className="card-label">{t('manager_reports.summary.approved')}</div>
                  </div>
                </div>
                <div className="summary-card rejected">
                  <div className="card-icon">❌</div>
                  <div className="card-content">
                    <div className="card-value">{reportData.summary.rejected}</div>
                    <div className="card-label">{t('manager_reports.summary.rejected')}</div>
                  </div>
                </div>
                <div className="summary-card pending">
                  <div className="card-icon">⏳</div>
                  <div className="card-content">
                    <div className="card-value">{reportData.summary.pending}</div>
                    <div className="card-label">{t('manager_reports.summary.pending')}</div>
                  </div>
                </div>
              </div>

              {/* Charts Row 1 */}
              <div className="charts-row">
                <div className="chart-card">
                  <h3>📅 {t('manager_reports.charts.applications_by_month')}</h3>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={reportData.byMonth}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="applications" name={t('manager_reports.labels.applications')} fill="#0088FE" />
                        <Bar dataKey="approved" name={t('manager_reports.labels.approved')} fill="#00C49F" />
                        <Bar dataKey="rejected" name={t('manager_reports.labels.rejected')} fill="#FF8042" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="chart-card">
                  <h3>🏢 {t('manager_reports.charts.applications_by_department')}</h3>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={reportData.byDepartment}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="department" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="applications" name={t('manager_reports.labels.applications')} fill="#8884D8" />
                        <Bar dataKey="approvalRate" name={t('manager_reports.labels.approval_rate_pct')} fill="#82CA9D" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Charts Row 2 */}
              <div className="charts-row">
                <div className="chart-card">
                  <h3>📊 {t('manager_reports.charts.leave_type_distribution')}</h3>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={reportData.byLeaveType}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          nameKey="leaveType"
                          label={({ name, percent = 0 }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {reportData.byLeaveType.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="chart-card">
                  <h3>📈 {t('manager_reports.charts.leave_trends')}</h3>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={reportData.leaveTrends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Legend />
                        <Line 
                          yAxisId="left"
                          type="monotone" 
                          dataKey="applications" 
                          name={t('manager_reports.labels.applications')}
                          stroke="#0088FE" 
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          dataKey="avgProcessingTime" 
                          name={t('manager_reports.labels.avg_processing_time_days')}
                          stroke="#FF8042" 
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'performance' && reportData && (
            <div className="performance-tab">
              <div className="performance-header">
                <h2>👥 {t('manager_reports.performance.title')}</h2>
                <p>{t('manager_reports.performance.subtitle')}</p>
              </div>

              <div className="performance-stats">
                <div className="stat-card">
                  <div className="stat-icon">🏆</div>
                  <div className="stat-content">
                    <div className="stat-value">
                      {Math.max(...reportData.teamPerformance.map(p => p.approvalRate), 0)}%
                    </div>
                    <div className="stat-label">{t('manager_reports.performance.highest_approval')}</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">📊</div>
                  <div className="stat-content">
                    <div className="stat-value">
                      {Math.round(reportData.teamPerformance.reduce((sum, p) => sum + p.applications, 0) / reportData.teamPerformance.length) || 0}
                    </div>
                    <div className="stat-label">{t('manager_reports.performance.avg_applications')}</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">⏱️</div>
                  <div className="stat-content">
                    <div className="stat-value">
                      {Math.round(reportData.teamPerformance.reduce((sum, p) => sum + p.avgLeaveDuration, 0) / reportData.teamPerformance.length * 10) / 10 || 0}d
                    </div>
                    <div className="stat-label">{t('manager_reports.performance.avg_duration')}</div>
                  </div>
                </div>
              </div>

              <div className="performance-table-container">
                <table className="performance-table">
                  <thead>
                    <tr>
                      <th>{t('manager_reports.table.employee')}</th>
                      <th>{t('manager_reports.table.applications')}</th>
                      <th>{t('manager_reports.table.approval_rate')}</th>
                      <th>{t('manager_reports.table.avg_duration')}</th>
                      <th>{t('manager_reports.table.performance_score')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.teamPerformance.map((member, index) => {
                      const performanceScore = Math.round(
                        (member.approvalRate * 0.5) + 
                        ((100 - (member.applications > 10 ? 100 : member.applications * 10)) * 0.3) +
                        ((member.avgLeaveDuration < 5 ? 100 : 100 - (member.avgLeaveDuration - 5) * 10) * 0.2)
                      );
                      
                      return (
                        <tr key={index}>
                          <td>
                            <div className="employee-cell">
                              <div className="employee-avatar">
                                {member.employee.charAt(0).toUpperCase()}
                              </div>
                              <div className="employee-name">{member.employee}</div>
                            </div>
                          </td>
                          <td>
                            <span className={`count-badge ${member.applications > 5 ? 'high' : 'low'}`}>
                              {member.applications}
                            </span>
                          </td>
                          <td>
                            <div className="rate-display">
                              <div className="rate-bar">
                                <div 
                                  className="rate-fill"
                                  style={{ width: `${member.approvalRate}%` }}
                                />
                              </div>
                              <span className="rate-value">{member.approvalRate}%</span>
                            </div>
                          </td>
                          <td>
                            <span className="duration-badge">
                              {t('manager_reports.table.days', { days: member.avgLeaveDuration })}
                            </span>
                          </td>
                          <td>
                            <div className={`score-badge ${performanceScore >= 80 ? 'excellent' : performanceScore >= 60 ? 'good' : 'needs-improvement'}`}>
                              {t('manager_reports.table.score', { score: performanceScore })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="performance-insights">
                <h3>💡 {t('manager_reports.performance.insights_title')}</h3>
                <div className="insights-grid">
                  {reportData.peakLeavePeriods.length > 0 && (
                    <div className="insight-card">
                      <div className="insight-icon">📅</div>
                      <div className="insight-content">
                        <h4>{t('manager_reports.performance.peak_period')}</h4>
                        <p>{t('manager_reports.performance.peak_period_desc', { period: reportData.peakLeavePeriods[0]?.period })}</p>
                      </div>
                    </div>
                  )}
                  <div className="insight-card">
                    <div className="insight-icon">⚡</div>
                    <div className="insight-content">
                      <h4>{t('manager_reports.performance.processing_efficiency')}</h4>
                      <p>{t('manager_reports.performance.processing_efficiency_desc', { days: reportData.summary.averageProcessingTime })}</p>
                    </div>
                  </div>
                  {reportData.byLeaveType.length > 0 && (
                    <div className="insight-card">
                      <div className="insight-icon">🏖️</div>
                      <div className="insight-content">
                        <h4>{t('manager_reports.performance.most_common_type')}</h4>
                        <p>{t('manager_reports.performance.most_common_type_desc', { type: reportData.byLeaveType[0]?.leaveType, percent: (reportData.byLeaveType[0]?.count / reportData.summary.totalApplications * 100).toFixed(0) })}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && reportData && (
            <div className="analytics-tab">
              <h2>📈 {t('manager_reports.analytics.title')}</h2>
              
              <div className="analytics-grid">
                <div className="analytics-card wide">
                  <h3>📊 {t('manager_reports.analytics.department_comparison')}</h3>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={400}>
                      <AreaChart data={reportData.byDepartment}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="department" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Area 
                          type="monotone" 
                          dataKey="applications" 
                          name={t('manager_reports.labels.applications')}
                          stroke="#8884D8" 
                          fill="#8884D8" 
                          fillOpacity={0.3}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="approvalRate" 
                          name={t('manager_reports.labels.approval_rate_pct')}
                          stroke="#82CA9D" 
                          fill="#82CA9D" 
                          fillOpacity={0.3}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="analytics-card">
                  <h3>📋 {t('manager_reports.analytics.approval_distribution')}</h3>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={reportData.teamPerformance.slice(0, 5)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="employee" angle={-45} textAnchor="end" height={80} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="approvalRate" name={t('manager_reports.labels.approval_rate_pct')} fill="#0088FE" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="analytics-card">
                  <h3>⏱️ {t('manager_reports.analytics.processing_time_trend')}</h3>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={reportData.leaveTrends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Line 
                          type="monotone" 
                          dataKey="avgProcessingTime" 
                          name={t('manager_reports.labels.avg_processing_time_days')}
                          stroke="#FF8042" 
                          strokeWidth={3}
                          dot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="analytics-insights">
                <h3>🔍 {t('manager_reports.analytics.key_insights')}</h3>
                <div className="insights-list">
                  {reportData.summary.approvalRate >= 80 ? (
                    <div className="insight positive">
                      ✅ <strong>{t('manager_reports.analytics.high_approval_title')}</strong> {t('manager_reports.analytics.high_approval_desc', { rate: reportData.summary.approvalRate })}
                    </div>
                  ) : (
                    <div className="insight warning">
                      ⚠️ <strong>{t('manager_reports.analytics.approval_rate_title')}</strong> {t('manager_reports.analytics.approval_rate_desc', { rate: reportData.summary.approvalRate })}
                    </div>
                  )}
                  
                  {reportData.summary.averageProcessingTime > 3 ? (
                    <div className="insight warning">
                      ⏳ <strong>{t('manager_reports.analytics.processing_time_title')}</strong> {t('manager_reports.analytics.processing_time_desc', { days: reportData.summary.averageProcessingTime })}
                    </div>
                  ) : (
                    <div className="insight positive">
                      ⚡ <strong>{t('manager_reports.analytics.quick_processing_title')}</strong> {t('manager_reports.analytics.quick_processing_desc', { days: reportData.summary.averageProcessingTime })}
                    </div>
                  )}
                  
                  {reportData.byLeaveType.length > 0 && reportData.byLeaveType[0].count / reportData.summary.totalApplications > 0.5 && (
                    <div className="insight info">
                      📊 <strong>{t('manager_reports.analytics.leave_distribution_title')}</strong> {t('manager_reports.analytics.leave_distribution_desc', { type: reportData.byLeaveType[0].leaveType })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'details' && reportData && (
            <div className="details-tab">
              <h2>📋 {t('manager_reports.details.title')}</h2>
              
              <div className="detailed-sections">
                <div className="detailed-section">
                  <h3>📅 {t('manager_reports.details.monthly_breakdown')}</h3>
                  <table className="detailed-table">
                    <thead>
                      <tr>
                        <th>{t('manager_reports.details.table.month')}</th>
                        <th>{t('manager_reports.details.table.applications')}</th>
                        <th>{t('manager_reports.details.table.approved')}</th>
                        <th>{t('manager_reports.details.table.rejected')}</th>
                        <th>{t('manager_reports.details.table.approval_rate')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.byMonth.map((month, index) => (
                        <tr key={index}>
                          <td>{month.month}</td>
                          <td>{month.applications}</td>
                          <td>{month.approved}</td>
                          <td>{month.rejected}</td>
                          <td>
                            {month.applications > 0 
                              ? `${Math.round((month.approved / month.applications) * 100)}%` 
                              : '0%'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="detailed-section">
                  <h3>🏢 {t('manager_reports.details.department_performance')}</h3>
                  <table className="detailed-table">
                    <thead>
                      <tr>
                        <th>{t('manager_reports.details.table.department')}</th>
                        <th>{t('manager_reports.details.table.applications')}</th>
                        <th>{t('manager_reports.details.table.approval_rate')}</th>
                        <th>{t('manager_reports.details.table.performance')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.byDepartment.map((dept, index) => (
                        <tr key={index}>
                          <td>{dept.department}</td>
                          <td>{dept.applications}</td>
                          <td>{dept.approvalRate}%</td>
                          <td>
                            {dept.approvalRate >= 80 ? t('manager_reports.details.performance.excellent') : 
                             dept.approvalRate >= 60 ? t('manager_reports.details.performance.good') : 
                             dept.approvalRate >= 40 ? t('manager_reports.details.performance.average') : t('manager_reports.details.performance.needs_improvement')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="detailed-section">
                  <h3>🏖️ {t('manager_reports.details.leave_type_analysis')}</h3>
                  <table className="detailed-table">
                    <thead>
                      <tr>
                        <th>{t('manager_reports.details.table.leave_type')}</th>
                        <th>{t('manager_reports.details.table.count')}</th>
                        <th>{t('manager_reports.details.table.percentage')}</th>
                        <th>{t('manager_reports.details.table.avg_duration')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.byLeaveType.map((type, index) => (
                        <tr key={index}>
                          <td>{type.leaveType}</td>
                          <td>{type.count}</td>
                          <td>
                            {reportData.summary.totalApplications > 0 
                              ? `${((type.count / reportData.summary.totalApplications) * 100).toFixed(1)}%` 
                              : '0%'}
                          </td>
                          <td>{t('manager_reports.details.table.days', { days: type.avgDuration.toFixed(1) })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="summary-box">
                <h3>📝 {t('manager_reports.details.executive_summary')}</h3>
                <div className="summary-content">
                  <p>
                    {t('manager_reports.details.summary_period', {
                      start: formatDate(filters.startDate),
                      end: formatDate(filters.endDate),
                      total: reportData.summary.totalApplications
                    })}
                  </p>
                  <p>
                    {t('manager_reports.details.summary_approval', {
                      rate: reportData.summary.approvalRate,
                      days: reportData.summary.averageProcessingTime
                    })}
                  </p>
                  <p>
                    {t('manager_reports.details.summary_most_used', {
                      type: reportData.byLeaveType[0]?.leaveType || t('common.na'),
                      percent: reportData.summary.totalApplications > 0
                        ? ((reportData.byLeaveType[0]?.count || 0) / reportData.summary.totalApplications * 100).toFixed(1)
                        : '0'
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading overlay for report content */}
      {loading && reportData && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <p>{t('manager_reports.updating')}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerReports;
