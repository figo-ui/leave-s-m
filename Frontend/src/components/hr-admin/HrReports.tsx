import React, { useState } from 'react';
import './HrReports.css';

const HrReports: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState('department-usage');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });

  const reportData = {
    'department-usage': [
      { department: 'Engineering', totalLeaves: 45, averageDuration: 2.5, approvalRate: 85 },
      { department: 'Marketing', totalLeaves: 32, averageDuration: 3.2, approvalRate: 78 },
      { department: 'Sales', totalLeaves: 28, averageDuration: 2.8, approvalRate: 92 },
      { department: 'HR', totalLeaves: 18, averageDuration: 2.1, approvalRate: 95 },
    ],
    'leave-types': [
      { type: 'Annual Leave', usage: 65, remaining: 35 },
      { type: 'Sick Leave', usage: 20, remaining: 80 },
      { type: 'Emergency Leave', usage: 10, remaining: 90 },
      { type: 'Maternity Leave', usage: 5, remaining: 95 },
    ]
  };

  const generateReport = () => {
    // In a real app, this would generate and download a comprehensive report
    alert(`Generating ${selectedReport} report for ${dateRange.startDate} to ${dateRange.endDate}`);
  };

  const exportToExcel = () => {
    alert('Exporting to Excel...');
  };

  return (
    <div className="hr-reports">
      <div className="page-header">
        <h1>HR Analytics & Reports</h1>
        <p>Comprehensive analytics and reporting for HR administration</p>
      </div>

      <div className="reports-controls">
        <div className="report-selection">
          <label>Report Type:</label>
          <select 
            value={selectedReport} 
            onChange={(e) => setSelectedReport(e.target.value)}
          >
            <option value="department-usage">Department Leave Usage</option>
            <option value="leave-types">Leave Type Analysis</option>
            <option value="employee-trends">Employee Trends</option>
            <option value="compliance">Compliance Reports</option>
          </select>
        </div>

        <div className="date-selection">
          <label>Date Range:</label>
          <input 
            type="date" 
            value={dateRange.startDate}
            onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
            aria-label="Start date"
            title="Start date"
            placeholder="Start date"
          />
          <span>to</span>
          <input 
            type="date" 
            value={dateRange.endDate}
            onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
            aria-label="End date"
            title="End date"
            placeholder="End date"
          />
        </div>

        <div className="report-actions">
          <button className="generate-btn" onClick={generateReport}>
            Generate Report
          </button>
          <button className="export-btn" onClick={exportToExcel}>
            Export to Excel
          </button>
        </div>
      </div>

      <div className="report-content">
        <div className="report-summary-cards">
          <div className="summary-card">
            <h3>Total Leave Days</h3>
            <span className="summary-number">1,247</span>
            <span className="summary-trend">↑ 12% from last period</span>
          </div>
          <div className="summary-card">
            <h3>Approval Rate</h3>
            <span className="summary-number">84%</span>
            <span className="summary-trend">↑ 3% from last period</span>
          </div>
          <div className="summary-card">
            <h3>Average Duration</h3>
            <span className="summary-number">2.7 days</span>
            <span className="summary-trend">↓ 0.3 days</span>
          </div>
        </div>

        <div className="report-data">
          <h2>
            {selectedReport === 'department-usage' && 'Department Leave Usage Report'}
            {selectedReport === 'leave-types' && 'Leave Type Analysis Report'}
            {selectedReport === 'employee-trends' && 'Employee Leave Trends'}
            {selectedReport === 'compliance' && 'Compliance Reports'}
          </h2>
          
          <table>
            <thead>
              <tr>
                {selectedReport === 'department-usage' && (
                  <>
                    <th>Department</th>
                    <th>Total Leaves</th>
                    <th>Average Duration</th>
                    <th>Approval Rate</th>
                  </>
                )}
                {selectedReport === 'leave-types' && (
                  <>
                    <th>Leave Type</th>
                    <th>Usage %</th>
                    <th>Remaining %</th>
                    <th>Trend</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {reportData[selectedReport as keyof typeof reportData]?.map((item, index) => (
                <tr key={index}>
                  {selectedReport === 'department-usage' && (
                    <>
                      <td>{item.department}</td>
                      <td>{item.totalLeaves}</td>
                      <td>{item.averageDuration} days</td>
                      <td>
                        <div className="approval-rate">
                          <span className="rate">{item.approvalRate}%</span>
                          <div className="rate-bar">
                            <div 
                              className="rate-fill" 
                              style={{ width: `${item.approvalRate}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                    </>
                  )}
                  {selectedReport === 'leave-types' && (
                    <>
                      <td>{item.type}</td>
                      <td>{item.usage}%</td>
                      <td>{item.remaining}%</td>
                      <td>
                        <span className={`trend ${item.usage > 50 ? 'high' : 'low'}`}>
                          {item.usage > 50 ? 'High Usage' : 'Low Usage'}
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="report-insights">
          <h3>Key Insights</h3>
          <ul>
            <li>Engineering department shows highest leave utilization</li>
            <li>Approval rates have improved by 5% compared to last quarter</li>
            <li>Emergency leave usage remains within acceptable limits</li>
            <li>Consider reviewing leave policies for high-utilization departments</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HrReports;