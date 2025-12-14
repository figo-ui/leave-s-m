// components/ManagerReports.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../utils/api';
import { Leave, User, LeaveType } from '../../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
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
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
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
        const members = teamResponse.data as User[];
        setTeamMembers(members);
        
        // Extract unique departments
        const uniqueDepts = Array.from(new Set(members.map(m => m.department))).sort();
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
      if (filters.leaveType !== 'all' && leave.leaveTypeId.toString() !== filters.leaveType) {
        return false;
      }

      // Employee filter
      if (filters.employee !== 'all' && leave.employeeId.toString() !== filters.employee) {
        return false;
      }

      // Only include team members' leaves
      const isTeamMember = teamMembers.some(member => member.id === leave.employeeId);
      return isTeamMember;
    });
  };

  const generateReportData = (leaves: Leave[]): ReportData => {
    const now = new Date();
    const threeMonthsAgo = new Date(now.setMonth(now.getMonth() - 3));

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
      const deptLeaves = leaves.filter(l => l.employee?.department === member.department);
      const deptApproved = deptLeaves.filter(l => l.status === 'APPROVED' || l.status === 'HR_APPROVED').length;
      const deptRate = deptLeaves.length > 0 ? Math.round((deptApproved / deptLeaves.length) * 100) : 0;
      
      return {
        department: member.department,
        applications: deptLeaves.length,
        approvalRate: deptRate
      };
    }).filter((dept, index, self) =>
      index === self.findIndex(d => d.department === dept.department)
    );

    // Group by leave type
    const byLeaveType = leaves.reduce((acc, leave) => {
      const typeName = leave.leaveType?.name || 'Unknown';
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
      const data = JSON.stringify(reportData, null, 2);
      
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
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const convertToCSV = (data: ReportData | null): string => {
    if (!data) return '';
    
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Total Applications', data.summary.totalApplications.toString()],
      ['Approved', data.summary.approved.toString()],
      ['Rejected', data.summary.rejected.toString()],
      ['Pending', data.summary.pending.toString()],
      ['Approval Rate', `${data.summary.approvalRate}%`],
      ['Average Processing Time', `${data.summary.averageProcessingTime} days`],
      ['', ''],
      ['Month', 'Applications', 'Approved', 'Rejected'],
      ...data.byMonth.map(m => [m.month, m.applications.toString(), m.approved.toString(), m.rejected.toString()])
    ];
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading && !reportData) {
    return (
      <div className="manager-reports">
        <div className="page-header">
          <h1>Manager Reports</h1>
          <p>Loading report data...</p>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Generating your reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="manager-reports">
      <div className="page-header">
        <div className="header-content">
          <div className="header-title">
            <h1>📊 Manager Reports</h1>
            <p>Analytics and insights for your team's leave management</p>
          </div>
          <div className="header-actions">
            <div className="export-dropdown">
              <button 
                className="export-btn"
                disabled={exporting || !reportData}
              >
                {exporting ? 'Exporting...' : '📥 Export Report'}
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
          <button onClick={() => setError('')} className="error-close">×</button>
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-card">
          <h3>📅 Date Range</h3>
          <div className="date-filters">
            <div className="date-input">
              <label>From</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>
            <div className="date-input">
              <label>To</label>
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
          <h3>🎯 Filters</h3>
          <div className="filter-grid">
            <div className="filter-input">
              <label>Department</label>
              <select
                value={filters.department}
                onChange={(e) => handleFilterChange('department', e.target.value)}
              >
                <option value="all">All Departments</option>
                {departments.filter(d => d !== 'all').map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div className="filter-input">
              <label>Leave Type</label>
              <select
                value={filters.leaveType}
                onChange={(e) => handleFilterChange('leaveType', e.target.value)}
              >
                <option value="all">All Leave Types</option>
                {leaveTypes.map(type => (
                  <option key={type.id} value={type.id.toString()}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-input">
              <label>Employee</label>
              <select
                value={filters.employee}
                onChange={(e) => handleFilterChange('employee', e.target.value)}
              >
                <option value="all">All Employees</option>
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
          <h3>📈 Quick Stats</h3>
          {reportData && (
            <div className="quick-stats">
              <div className="quick-stat">
                <div className="stat-value">{reportData.summary.totalApplications}</div>
                <div className="stat-label">Total Applications</div>
              </div>
              <div className="quick-stat">
                <div className="stat-value">{reportData.summary.approvalRate}%</div>
                <div className="stat-label">Approval Rate</div>
              </div>
              <div className="quick-stat">
                <div className="stat-value">{reportData.summary.averageProcessingTime}d</div>
                <div className="stat-label">Avg. Processing Time</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Report Period */}
      <div className="report-period">
        <h3>
          📋 Report Period: {formatDate(filters.startDate)} - {formatDate(filters.endDate)}
        </h3>
        <button 
          className="refresh-btn"
          onClick={loadReportData}
          disabled={loading}
        >
          {loading ? '🔄 Refreshing...' : '🔄 Refresh Data'}
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="report-tabs">
        <button 
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button 
          className={`tab-btn ${activeTab === 'performance' ? 'active' : ''}`}
          onClick={() => setActiveTab('performance')}
        >
          👥 Team Performance
        </button>
        <button 
          className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          📈 Analytics
        </button>
        <button 
          className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          📋 Detailed View
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
                    <div className="card-label">Total Applications</div>
                  </div>
                </div>
                <div className="summary-card approved">
                  <div className="card-icon">✅</div>
                  <div className="card-content">
                    <div className="card-value">{reportData.summary.approved}</div>
                    <div className="card-label">Approved</div>
                  </div>
                </div>
                <div className="summary-card rejected">
                  <div className="card-icon">❌</div>
                  <div className="card-content">
                    <div className="card-value">{reportData.summary.rejected}</div>
                    <div className="card-label">Rejected</div>
                  </div>
                </div>
                <div className="summary-card pending">
                  <div className="card-icon">⏳</div>
                  <div className="card-content">
                    <div className="card-value">{reportData.summary.pending}</div>
                    <div className="card-label">Pending</div>
                  </div>
                </div>
              </div>

              {/* Charts Row 1 */}
              <div className="charts-row">
                <div className="chart-card">
                  <h3>📅 Applications by Month</h3>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={reportData.byMonth}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="applications" name="Applications" fill="#0088FE" />
                        <Bar dataKey="approved" name="Approved" fill="#00C49F" />
                        <Bar dataKey="rejected" name="Rejected" fill="#FF8042" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="chart-card">
                  <h3>🏢 Applications by Department</h3>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={reportData.byDepartment}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="department" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="applications" name="Applications" fill="#8884D8" />
                        <Bar dataKey="approvalRate" name="Approval Rate %" fill="#82CA9D" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Charts Row 2 */}
              <div className="charts-row">
                <div className="chart-card">
                  <h3>📊 Leave Type Distribution</h3>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={reportData.byLeaveType}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ leaveType, percent }) => `${leaveType}: ${(percent * 100).toFixed(0)}%`}
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
                  <h3>📈 Leave Trends</h3>
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
                          name="Applications" 
                          stroke="#0088FE" 
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          dataKey="avgProcessingTime" 
                          name="Avg Processing Time (days)" 
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
                <h2>👥 Team Performance Analysis</h2>
                <p>Individual performance metrics for team members</p>
              </div>

              <div className="performance-stats">
                <div className="stat-card">
                  <div className="stat-icon">🏆</div>
                  <div className="stat-content">
                    <div className="stat-value">
                      {Math.max(...reportData.teamPerformance.map(p => p.approvalRate), 0)}%
                    </div>
                    <div className="stat-label">Highest Approval Rate</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">📊</div>
                  <div className="stat-content">
                    <div className="stat-value">
                      {Math.round(reportData.teamPerformance.reduce((sum, p) => sum + p.applications, 0) / reportData.teamPerformance.length) || 0}
                    </div>
                    <div className="stat-label">Avg Applications per Member</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">⏱️</div>
                  <div className="stat-content">
                    <div className="stat-value">
                      {Math.round(reportData.teamPerformance.reduce((sum, p) => sum + p.avgLeaveDuration, 0) / reportData.teamPerformance.length * 10) / 10 || 0}d
                    </div>
                    <div className="stat-label">Avg Leave Duration</div>
                  </div>
                </div>
              </div>

              <div className="performance-table-container">
                <table className="performance-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Applications</th>
                      <th>Approval Rate</th>
                      <th>Avg Leave Duration</th>
                      <th>Performance Score</th>
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
                              {member.avgLeaveDuration} days
                            </span>
                          </td>
                          <td>
                            <div className={`score-badge ${performanceScore >= 80 ? 'excellent' : performanceScore >= 60 ? 'good' : 'needs-improvement'}`}>
                              {performanceScore}/100
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="performance-insights">
                <h3>💡 Performance Insights</h3>
                <div className="insights-grid">
                  {reportData.peakLeavePeriods.length > 0 && (
                    <div className="insight-card">
                      <div className="insight-icon">📅</div>
                      <div className="insight-content">
                        <h4>Peak Leave Period</h4>
                        <p>Most leaves were taken in {reportData.peakLeavePeriods[0]?.period}</p>
                      </div>
                    </div>
                  )}
                  <div className="insight-card">
                    <div className="insight-icon">⚡</div>
                    <div className="insight-content">
                      <h4>Processing Efficiency</h4>
                      <p>Average approval time: {reportData.summary.averageProcessingTime} days</p>
                    </div>
                  </div>
                  {reportData.byLeaveType.length > 0 && (
                    <div className="insight-card">
                      <div className="insight-icon">🏖️</div>
                      <div className="insight-content">
                        <h4>Most Common Leave Type</h4>
                        <p>{reportData.byLeaveType[0]?.leaveType} ({(reportData.byLeaveType[0]?.count / reportData.summary.totalApplications * 100).toFixed(0)}% of all leaves)</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && reportData && (
            <div className="analytics-tab">
              <h2>📈 Advanced Analytics</h2>
              
              <div className="analytics-grid">
                <div className="analytics-card wide">
                  <h3>📊 Department Comparison</h3>
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
                          name="Applications" 
                          stroke="#8884D8" 
                          fill="#8884D8" 
                          fillOpacity={0.3}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="approvalRate" 
                          name="Approval Rate %" 
                          stroke="#82CA9D" 
                          fill="#82CA9D" 
                          fillOpacity={0.3}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="analytics-card">
                  <h3>📋 Approval Rate Distribution</h3>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={reportData.teamPerformance.slice(0, 5)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="employee" angle={-45} textAnchor="end" height={80} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="approvalRate" name="Approval Rate %" fill="#0088FE" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="analytics-card">
                  <h3>⏱️ Processing Time Trend</h3>
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
                          name="Avg Processing Time (days)" 
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
                <h3>🔍 Key Insights</h3>
                <div className="insights-list">
                  {reportData.summary.approvalRate >= 80 ? (
                    <div className="insight positive">
                      ✅ <strong>High Approval Rate:</strong> Your team has an excellent approval rate of {reportData.summary.approvalRate}%
                    </div>
                  ) : (
                    <div className="insight warning">
                      ⚠️ <strong>Approval Rate:</strong> Consider reviewing processes to improve the {reportData.summary.approvalRate}% approval rate
                    </div>
                  )}
                  
                  {reportData.summary.averageProcessingTime > 3 ? (
                    <div className="insight warning">
                      ⏳ <strong>Processing Time:</strong> Average processing time of {reportData.summary.averageProcessingTime} days could be improved
                    </div>
                  ) : (
                    <div className="insight positive">
                      ⚡ <strong>Quick Processing:</strong> Great job processing leaves in {reportData.summary.averageProcessingTime} days on average
                    </div>
                  )}
                  
                  {reportData.byLeaveType.length > 0 && reportData.byLeaveType[0].count / reportData.summary.totalApplications > 0.5 && (
                    <div className="insight info">
                      📊 <strong>Leave Distribution:</strong> {reportData.byLeaveType[0].leaveType} accounts for over 50% of all leaves
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'details' && reportData && (
            <div className="details-tab">
              <h2>📋 Detailed Report View</h2>
              
              <div className="detailed-sections">
                <div className="detailed-section">
                  <h3>📅 Monthly Breakdown</h3>
                  <table className="detailed-table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Applications</th>
                        <th>Approved</th>
                        <th>Rejected</th>
                        <th>Approval Rate</th>
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
                  <h3>🏢 Department Performance</h3>
                  <table className="detailed-table">
                    <thead>
                      <tr>
                        <th>Department</th>
                        <th>Applications</th>
                        <th>Approval Rate</th>
                        <th>Performance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.byDepartment.map((dept, index) => (
                        <tr key={index}>
                          <td>{dept.department}</td>
                          <td>{dept.applications}</td>
                          <td>{dept.approvalRate}%</td>
                          <td>
                            {dept.approvalRate >= 80 ? 'Excellent' : 
                             dept.approvalRate >= 60 ? 'Good' : 
                             dept.approvalRate >= 40 ? 'Average' : 'Needs Improvement'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="detailed-section">
                  <h3>🏖️ Leave Type Analysis</h3>
                  <table className="detailed-table">
                    <thead>
                      <tr>
                        <th>Leave Type</th>
                        <th>Count</th>
                        <th>Percentage</th>
                        <th>Avg Duration</th>
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
                          <td>{type.avgDuration.toFixed(1)} days</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="summary-box">
                <h3>📝 Executive Summary</h3>
                <div className="summary-content">
                  <p>
                    During the period from {formatDate(filters.startDate)} to {formatDate(filters.endDate)}, 
                    your team processed a total of <strong>{reportData.summary.totalApplications}</strong> leave applications.
                  </p>
                  <p>
                    The overall approval rate was <strong>{reportData.summary.approvalRate}%</strong> with an average 
                    processing time of <strong>{reportData.summary.averageProcessingTime} days</strong>.
                  </p>
                  <p>
                    <strong>{reportData.byLeaveType[0]?.leaveType || 'N/A'}</strong> was the most frequently used leave type, 
                    accounting for {reportData.summary.totalApplications > 0 
                      ? `${((reportData.byLeaveType[0]?.count || 0) / reportData.summary.totalApplications * 100).toFixed(1)}%` 
                      : '0%'} of all applications.
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
            <p>Updating report data...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerReports;