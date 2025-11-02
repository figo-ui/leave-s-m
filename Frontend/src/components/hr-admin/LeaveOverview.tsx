import React, { useState, useEffect } from 'react';
import { LeaveService } from '../../utils/leaveService';
import { useAuth } from '../../contexts/AuthContext';
import './LeaveOverview.css';

interface LeaveApplication {
  id: number;
  employeeName: string;
  employeeId: string;
  employeeEmail: string;
  department: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: 'pending' | 'approved' | 'rejected' | 'hr_pending' | 'hr_approved' | 'hr_rejected';
  reason: string;
  appliedDate: string;
  currentApprover: 'manager' | 'hr';
  managerNotes?: string;
  hrNotes?: string;
}

const LeaveOverview: React.FC = () => {
  const { user } = useAuth();
  const [allApplications, setAllApplications] = useState<LeaveApplication[]>([]);
  const [filteredApplications, setFilteredApplications] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('all');

  useEffect(() => {
    loadAllApplications();
  }, []);

  useEffect(() => {
    filterApplications();
  }, [allApplications, activeTab, searchTerm, departmentFilter, leaveTypeFilter]);

  const loadAllApplications = () => {
    setLoading(true);
    const applications = LeaveService.getAllApplications();
    setAllApplications(applications);
    setLoading(false);
  };

  const filterApplications = () => {
    let filtered = allApplications;

    // Status filter
    if (activeTab !== 'all') {
      filtered = filtered.filter(app => {
        if (activeTab === 'pending') return app.status.includes('pending');
        if (activeTab === 'approved') return app.status.includes('approved');
        if (activeTab === 'rejected') return app.status.includes('rejected');
        return true;
      });
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(app =>
        app.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Department filter
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(app => app.department === departmentFilter);
    }

    // Leave type filter
    if (leaveTypeFilter !== 'all') {
      filtered = filtered.filter(app => app.leaveType === leaveTypeFilter);
    }

    setFilteredApplications(filtered);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { class: string; label: string } } = {
      pending: { class: 'status-pending', label: 'Pending' },
      approved: { class: 'status-approved', label: 'Approved' },
      rejected: { class: 'status-rejected', label: 'Rejected' },
      hr_pending: { class: 'status-pending', label: 'HR Pending' },
      hr_approved: { class: 'status-approved', label: 'HR Approved' },
      hr_rejected: { class: 'status-rejected', label: 'HR Rejected' },
    };
    
    const config = statusConfig[status] || { class: 'status-pending', label: status };
    return <span className={`status-badge ${config.class}`}>{config.label}</span>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const stats = LeaveService.getOverallStats();
  const departmentStats = LeaveService.getDepartmentStats();

  const departments = [...new Set(allApplications.map(app => app.department))];
  const leaveTypes = [...new Set(allApplications.map(app => app.leaveType))];

  return (
    <div className="leave-overview">
      <div className="page-header">
        <h1>Leave Overview</h1>
        <p>Comprehensive view of all leave applications across the organization</p>
      </div>

      {/* Statistics Cards */}
      <div className="stats-container">
        <div className="stat-card total">
          <div className="stat-number">{stats.total}</div>
          <div className="stat-label">Total Applications</div>
        </div>
        <div className="stat-card pending">
          <div className="stat-number">{stats.pending}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card approved">
          <div className="stat-number">{stats.approved}</div>
          <div className="stat-label">Approved</div>
        </div>
        <div className="stat-card rejected">
          <div className="stat-number">{stats.rejected}</div>
          <div className="stat-label">Rejected</div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filter-group">
          <input
            type="text"
            placeholder="Search by employee, department, or ID..."
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
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <div className="tabs">
          <button className={`tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
            All Applications ({stats.total})
          </button>
          <button className={`tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
            Pending ({stats.pending})
          </button>
          <button className={`tab ${activeTab === 'approved' ? 'active' : ''}`} onClick={() => setActiveTab('approved')}>
            Approved ({stats.approved})
          </button>
          <button className={`tab ${activeTab === 'rejected' ? 'active' : ''}`} onClick={() => setActiveTab('rejected')}>
            Rejected ({stats.rejected})
          </button>
        </div>
      </div>

      {/* Department Statistics */}
      {departmentStats.length > 0 && (
        <div className="department-stats">
          <h3>Department Overview</h3>
          <div className="dept-stats-grid">
            {departmentStats.map(dept => (
              <div key={dept.department} className="dept-stat-card">
                <h4>{dept.department}</h4>
                <div className="dept-numbers">
                  <span className="total">Total: {dept.total}</span>
                  <span className="approved">✓ {dept.approved}</span>
                  <span className="pending">⏳ {dept.pending}</span>
                  <span className="rejected">✗ {dept.rejected}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leave Applications Table */}
      <div className="applications-container">
        <div className="table-header">
          <h3>Leave Applications ({filteredApplications.length})</h3>
          <button onClick={loadAllApplications} className="refresh-btn">
            🔄 Refresh
          </button>
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading applications...</p>
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="no-data">
            <div className="no-data-icon">📊</div>
            <h3>No Applications Found</h3>
            <p>No leave applications match your current filters</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="applications-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Leave Type</th>
                  <th>Leave Period</th>
                  <th>Duration</th>
                  <th>Applied Date</th>
                  <th>Status</th>
                  <th>Current Approver</th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.map(application => (
                  <tr key={application.id} className="application-row">
                    <td>
                      <div className="employee-info">
                        <div className="employee-name">{application.employeeName}</div>
                        <div className="employee-id">ID: {application.employeeId}</div>
                      </div>
                    </td>
                    <td>{application.department}</td>
                    <td className="leave-type">{application.leaveType}</td>
                    <td>
                      <div className="date-range">
                        <div>{formatDate(application.startDate)}</div>
                        <div>to {formatDate(application.endDate)}</div>
                      </div>
                    </td>
                    <td className="days">{application.days} days</td>
                    <td>{formatDate(application.appliedDate)}</td>
                    <td>{getStatusBadge(application.status)}</td>
                    <td>
                      <span className={`approver ${application.currentApprover}`}>
                        {application.currentApprover.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaveOverview;