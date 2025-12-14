import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../utils/api';
import './LeaveOverview.css';

interface LeaveApplication {
  id: number;
  employeeId: number;
  employee: {
    id: number;
    name: string;
    email: string;
    department: string;
    position: string;
    avatar?: string;
    manager?: {
      name: string;
      email: string;
    };
  };
  leaveType: {
    id: number;
    name: string;
    color?: string;
    requiresHRApproval: boolean;
  };
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
  appliedDate: string;
  currentApprover: string;
  managerNotes?: string;
  hrNotes?: string;
  managerApprovedDate?: string;
  hrApprovedDate?: string;
}

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  hrPending: number;
}

interface DepartmentStats {
  department: string;
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  hrPending: number;
}

const LeaveOverview: React.FC = () => {
  const { user } = useAuth();
  const [allApplications, setAllApplications] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'hr-pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('all');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'employee' | 'department' | 'duration'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [exportLoading, setExportLoading] = useState(false);

  // Load data on component mount
  useEffect(() => {
    loadAllApplications();
  }, []);

  const loadAllApplications = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('🔄 Loading all leave applications...');
      
      const response = await apiService.getLeaveOverview();
      
      if (response.success) {
        const applications = response.data || [];
        console.log(`✅ Loaded ${applications.length} applications`);
        setAllApplications(applications);
      } else {
        throw new Error(response.message || 'Failed to load applications');
      }
    } catch (error: any) {
      console.error('💥 Error loading applications:', error);
      setError(error.message || 'Failed to load leave applications');
    } finally {
      setLoading(false);
    }
  };

  // Memoized filtered and sorted applications
  const filteredApplications = useMemo(() => {
    let filtered = allApplications;

    // Status filter
    if (activeTab !== 'all') {
      filtered = filtered.filter(app => {
        switch (activeTab) {
          case 'pending':
            return app.status === 'PENDING_MANAGER';
          case 'hr-pending':
            return app.status === 'PENDING_HR';
          case 'approved':
            return app.status === 'APPROVED' || app.status === 'HR_APPROVED';
          case 'rejected':
            return app.status === 'REJECTED' || app.status === 'HR_REJECTED';
          default:
            return true;
        }
      });
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(app =>
        app.employee.name.toLowerCase().includes(term) ||
        app.employee.department.toLowerCase().includes(term) ||
        app.employee.email.toLowerCase().includes(term) ||
        app.leaveType.name.toLowerCase().includes(term)
      );
    }

    // Department filter
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(app => app.employee.department === departmentFilter);
    }

    // Leave type filter
    if (leaveTypeFilter !== 'all') {
      filtered = filtered.filter(app => app.leaveType.name === leaveTypeFilter);
    }

    // Date range filter
    const now = new Date();
    switch (dateRange) {
      case 'today':
        const today = new Date().toISOString().split('T')[0];
        filtered = filtered.filter(app => app.appliedDate.split('T')[0] === today);
        break;
      case 'week':
        const weekAgo = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
        filtered = filtered.filter(app => app.appliedDate.split('T')[0] >= weekAgo);
        break;
      case 'month':
        const monthAgo = new Date(now.setMonth(now.getMonth() - 1)).toISOString().split('T')[0];
        filtered = filtered.filter(app => app.appliedDate.split('T')[0] >= monthAgo);
        break;
    }

    return filtered;
  }, [allApplications, activeTab, searchTerm, departmentFilter, leaveTypeFilter, dateRange]);

  // Memoized sorted applications
  const sortedApplications = useMemo(() => {
    return [...filteredApplications].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.appliedDate).getTime() - new Date(b.appliedDate).getTime();
          break;
        case 'employee':
          comparison = a.employee.name.localeCompare(b.employee.name);
          break;
        case 'department':
          comparison = a.employee.department.localeCompare(b.employee.department);
          break;
        case 'duration':
          comparison = a.days - b.days;
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [filteredApplications, sortBy, sortOrder]);

  // Paginated applications
  const paginatedApplications = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedApplications.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedApplications, currentPage, itemsPerPage]);

  // Statistics
  const stats = useMemo((): Stats => {
    const total = allApplications.length;
    const pending = allApplications.filter(app => app.status === 'PENDING_MANAGER').length;
    const hrPending = allApplications.filter(app => app.status === 'PENDING_HR').length;
    const approved = allApplications.filter(app => 
      app.status === 'APPROVED' || app.status === 'HR_APPROVED'
    ).length;
    const rejected = allApplications.filter(app => 
      app.status === 'REJECTED' || app.status === 'HR_REJECTED'
    ).length;

    return { total, pending, approved, rejected, hrPending };
  }, [allApplications]);

  const departmentStats = useMemo((): DepartmentStats[] => {
    const departments = [...new Set(allApplications.map(app => app.employee.department))];
    
    return departments.map(dept => {
      const deptApps = allApplications.filter(app => app.employee.department === dept);
      return {
        department: dept,
        total: deptApps.length,
        approved: deptApps.filter(app => 
          app.status === 'APPROVED' || app.status === 'HR_APPROVED'
        ).length,
        pending: deptApps.filter(app => app.status === 'PENDING_MANAGER').length,
        hrPending: deptApps.filter(app => app.status === 'PENDING_HR').length,
        rejected: deptApps.filter(app => 
          app.status === 'REJECTED' || app.status === 'HR_REJECTED'
        ).length,
      };
    }).sort((a, b) => b.total - a.total);
  }, [allApplications]);

  const departments = useMemo(() => 
    [...new Set(allApplications.map(app => app.employee.department))].sort(),
    [allApplications]
  );

  const leaveTypes = useMemo(() => 
    [...new Set(allApplications.map(app => app.leaveType.name))].sort(),
    [allApplications]
  );

  const getStatusBadge = useCallback((status: string) => {
    const statusConfig: { [key: string]: { class: string; label: string; icon: string } } = {
      'PENDING_MANAGER': { class: 'status-pending', label: 'Pending Manager', icon: '⏳' },
      'PENDING_HR': { class: 'status-pending', label: 'Pending HR', icon: '👥' },
      'APPROVED': { class: 'status-approved', label: 'Approved', icon: '✅' },
      'HR_APPROVED': { class: 'status-approved', label: 'HR Approved', icon: '✅' },
      'REJECTED': { class: 'status-rejected', label: 'Rejected', icon: '❌' },
      'HR_REJECTED': { class: 'status-rejected', label: 'HR Rejected', icon: '❌' },
    };
    
    const config = statusConfig[status] || { class: 'status-pending', label: status, icon: '❓' };
    return (
      <span className={`status-badge ${config.class}`}>
        <span className="status-icon">{config.icon}</span>
        {config.label}
      </span>
    );
  }, []);

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }, []);

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const handleExport = async () => {
    try {
      setExportLoading(true);
      // In a real implementation, you would call an export API
      const csvContent = [
        ['Employee', 'Department', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Status', 'Applied Date'],
        ...sortedApplications.map(app => [
          app.employee.name,
          app.employee.department,
          app.leaveType.name,
          app.startDate,
          app.endDate,
          app.days.toString(),
          app.status,
          app.appliedDate
        ])
      ].map(row => row.join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `leave-overview-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      
      console.log('✅ Export completed');
    } catch (error) {
      console.error('Export error:', error);
      setError('Failed to export data');
    } finally {
      setExportLoading(false);
    }
  };

  const totalPages = Math.ceil(sortedApplications.length / itemsPerPage);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) {
        loadAllApplications();
      }
    }, 120000);

    return () => clearInterval(interval);
  }, [loading]);

  if (loading && allApplications.length === 0) {
    return (
      <div className="leave-overview">
        <div className="page-header">
          <h1>Leave Overview</h1>
          <p>Comprehensive view of all leave applications across the organization</p>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading leave applications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="leave-overview">
      <div className="page-header">
        <div className="header-content">
          <div>
            <h1>Leave Overview</h1>
            <p>Comprehensive view of all leave applications across the organization</p>
          </div>
          <div className="header-actions">
            <button 
              className="refresh-btn" 
              onClick={loadAllApplications}
              disabled={loading}
            >
              {loading ? '🔄 Loading...' : '🔄 Refresh'}
            </button>
            <button 
              className="export-btn"
              onClick={handleExport}
              disabled={exportLoading || sortedApplications.length === 0}
            >
              {exportLoading ? '📊 Exporting...' : '📊 Export CSV'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span className="error-icon">❌</span>
          {error}
          <button onClick={() => setError('')} className="error-close">×</button>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="stats-container">
        <div className="stat-card total">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-number">{stats.total}</div>
            <div className="stat-label">Total Applications</div>
          </div>
        </div>
        <div className="stat-card pending">
          <div className="stat-icon">⏳</div>
          <div className="stat-content">
            <div className="stat-number">{stats.pending + stats.hrPending}</div>
            <div className="stat-label">Pending</div>
            {stats.hrPending > 0 && (
              <div className="stat-subtext">({stats.hrPending} HR)</div>
            )}
          </div>
        </div>
        <div className="stat-card approved">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-number">{stats.approved}</div>
            <div className="stat-label">Approved</div>
          </div>
        </div>
        <div className="stat-card rejected">
          <div className="stat-icon">❌</div>
          <div className="stat-content">
            <div className="stat-number">{stats.rejected}</div>
            <div className="stat-label">Rejected</div>
          </div>
        </div>
      </div>

      {/* Advanced Filters Section */}
      <div className="filters-section">
        <div className="filter-group">
          <input
            type="text"
            placeholder="Search employees, departments, leave types..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-group">
          <select 
            value={departmentFilter} 
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <select 
            value={leaveTypeFilter} 
            onChange={(e) => setLeaveTypeFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Leave Types</option>
            {leaveTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <select 
            value={dateRange} 
            onChange={(e) => setDateRange(e.target.value as any)}
            className="filter-select"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
        </div>

        <div className="filter-group">
          <select 
            value={itemsPerPage} 
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="filter-select"
          >
            <option value={10}>10 per page</option>
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'all' ? 'active' : ''}`} 
            onClick={() => setActiveTab('all')}
          >
            All Applications ({stats.total})
          </button>
          <button 
            className={`tab ${activeTab === 'pending' ? 'active' : ''}`} 
            onClick={() => setActiveTab('pending')}
          >
            Pending ({stats.pending + stats.hrPending})
            {stats.hrPending > 0 && <span className="tab-badge">HR: {stats.hrPending}</span>}
          </button>
          <button 
            className={`tab ${activeTab === 'approved' ? 'active' : ''}`} 
            onClick={() => setActiveTab('approved')}
          >
            Approved ({stats.approved})
          </button>
          <button 
            className={`tab ${activeTab === 'rejected' ? 'active' : ''}`} 
            onClick={() => setActiveTab('rejected')}
          >
            Rejected ({stats.rejected})
          </button>
        </div>
      </div>

      {/* Department Statistics */}
      {departmentStats.length > 0 && (
        <div className="department-stats">
          <h3>📈 Department Overview</h3>
          <div className="dept-stats-grid">
            {departmentStats.slice(0, 6).map(dept => (
              <div key={dept.department} className="dept-stat-card">
                <h4>{dept.department}</h4>
                <div className="dept-numbers">
                  <div className="stat-row">
                    <span className="label">Total:</span>
                    <span className="value total">{dept.total}</span>
                  </div>
                  <div className="stat-row">
                    <span className="label">Approved:</span>
                    <span className="value approved">✓ {dept.approved}</span>
                  </div>
                  <div className="stat-row">
                    <span className="label">Pending:</span>
                    <span className="value pending">
                      ⏳ {dept.pending + dept.hrPending}
                      {dept.hrPending > 0 && <small> ({dept.hrPending} HR)</small>}
                    </span>
                  </div>
                  <div className="stat-row">
                    <span className="label">Rejected:</span>
                    <span className="value rejected">✗ {dept.rejected}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leave Applications Table */}
      <div className="applications-container">
        <div className="table-header">
          <div className="table-info">
            <h3>Leave Applications</h3>
            <span className="results-count">
              Showing {paginatedApplications.length} of {sortedApplications.length} applications
              {filteredApplications.length !== allApplications.length && ' (filtered)'}
            </span>
          </div>
          <div className="table-controls">
            <span className="auto-refresh">🔄 Auto-refresh in 2m</span>
          </div>
        </div>

        {sortedApplications.length === 0 ? (
          <div className="no-data">
            <div className="no-data-icon">
              {activeTab === 'all' ? '📊' : 
               activeTab === 'pending' ? '⏳' : 
               activeTab === 'approved' ? '✅' : '❌'}
            </div>
            <h3>No Applications Found</h3>
            <p>
              {activeTab === 'all' 
                ? "No leave applications match your current filters"
                : `No ${activeTab} applications found with the current filters`
              }
            </p>
            {(searchTerm || departmentFilter !== 'all' || leaveTypeFilter !== 'all') && (
              <button 
                className="clear-filters-btn"
                onClick={() => {
                  setSearchTerm('');
                  setDepartmentFilter('all');
                  setLeaveTypeFilter('all');
                  setDateRange('all');
                }}
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="applications-table">
                <thead>
                  <tr>
                    <th 
                      className={`sortable ${sortBy === 'employee' ? 'active' : ''}`}
                      onClick={() => handleSort('employee')}
                    >
                      Employee {sortBy === 'employee' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className={`sortable ${sortBy === 'department' ? 'active' : ''}`}
                      onClick={() => handleSort('department')}
                    >
                      Department {sortBy === 'department' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Leave Type</th>
                    <th>Leave Period</th>
                    <th 
                      className={`sortable ${sortBy === 'duration' ? 'active' : ''}`}
                      onClick={() => handleSort('duration')}
                    >
                      Duration {sortBy === 'duration' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className={`sortable ${sortBy === 'date' ? 'active' : ''}`}
                      onClick={() => handleSort('date')}
                    >
                      Applied {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Status</th>
                    <th>Approver</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedApplications.map(application => (
                    <tr key={application.id} className="application-row">
                      <td>
                        <div className="employee-info">
                          <div className="employee-name">{application.employee.name}</div>
                          <div className="employee-details">
                            <span className="employee-email">{application.employee.email}</span>
                            {application.employee.position && (
                              <span className="employee-position">{application.employee.position}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="department-tag">{application.employee.department}</span>
                      </td>
                      <td>
                        <span 
                          className="leave-type-tag"
                          style={{ backgroundColor: application.leaveType.color || '#667eea' }}
                        >
                          {application.leaveType.name}
                        </span>
                      </td>
                      <td>
                        <div className="date-range">
                          <div className="start-date">{formatDate(application.startDate)}</div>
                          <div className="end-date">to {formatDate(application.endDate)}</div>
                        </div>
                      </td>
                      <td>
                        <span className="days-badge">{application.days} day{application.days !== 1 ? 's' : ''}</span>
                      </td>
                      <td>{formatDate(application.appliedDate)}</td>
                      <td>{getStatusBadge(application.status)}</td>
                      <td>
                        <span className={`approver ${application.currentApprover.toLowerCase()}`}>
                          {application.currentApprover.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button 
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  ← Previous
                </button>
                
                <div className="pagination-pages">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <button
                        key={page}
                        className={`pagination-page ${currentPage === page ? 'active' : ''}`}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </button>
                    );
                  })}
                  {totalPages > 5 && (
                    <>
                      <span className="pagination-ellipsis">...</span>
                      <button
                        className={`pagination-page ${currentPage === totalPages ? 'active' : ''}`}
                        onClick={() => setCurrentPage(totalPages)}
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </div>

                <button 
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LeaveOverview;