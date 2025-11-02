import React, { useState } from 'react';
import './ManagerReports.css';

const ManagerReports: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState('leave-usage');

  const reportData = {
    'leave-usage': [
      { month: 'January', leaves: 8, approvals: 6, rejections: 2 },
      { month: 'February', leaves: 12, approvals: 10, rejections: 2 },
      { month: 'March', leaves: 10, approvals: 8, rejections: 2 },
    ],
    'team-performance': [
      { employee: 'John Doe', leavesTaken: 12, onTimeCompletion: 95 },
      { employee: 'Jane Smith', leavesTaken: 8, onTimeCompletion: 88 },
      { employee: 'Mike Johnson', leavesTaken: 15, onTimeCompletion: 92 },
    ]
  };

  const generateReport = () => {
    // In a real app, this would generate and download a report
    alert(`Generating ${selectedReport} report...`);
  };

  return (
    <div className="manager-reports">
      <div className="page-header">
        <h1>Reports & Analytics</h1>
        <p>Generate insights and reports for your team</p>
      </div>

      <div className="reports-container">
        <div className="report-sidebar">
          <h3>Report Types</h3>
          <button 
            className={`report-type ${selectedReport === 'leave-usage' ? 'active' : ''}`}
            onClick={() => setSelectedReport('leave-usage')}
          >
            Leave Usage Report
          </button>
          <button 
            className={`report-type ${selectedReport === 'team-performance' ? 'active' : ''}`}
            onClick={() => setSelectedReport('team-performance')}
          >
            Team Performance
          </button>
          <button 
            className={`report-type ${selectedReport === 'attendance' ? 'active' : ''}`}
            onClick={() => setSelectedReport('attendance')}
          >
            Attendance Summary
          </button>
        </div>

        <div className="report-content">
          <div className="report-header">
            <h2>
              {selectedReport === 'leave-usage' && 'Leave Usage Report'}
              {selectedReport === 'team-performance' && 'Team Performance Report'}
              {selectedReport === 'attendance' && 'Attendance Summary Report'}
            </h2>
            <button className="generate-btn" onClick={generateReport}>
              Generate Report
            </button>
          </div>

          <div className="report-data">
            <table>
              <thead>
                <tr>
                  {selectedReport === 'leave-usage' && (
                    <>
                      <th>Month</th>
                      <th>Total Leaves</th>
                      <th>Approvals</th>
                      <th>Rejections</th>
                    </>
                  )}
                  {selectedReport === 'team-performance' && (
                    <>
                      <th>Employee</th>
                      <th>Leaves Taken</th>
                      <th>On-time Completion</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {reportData[selectedReport as keyof typeof reportData]?.map((item, index) => (
                  <tr key={index}>
                    {selectedReport === 'leave-usage' && (
                      <>
                        <td>{item.month}</td>
                        <td>{item.leaves}</td>
                        <td>{item.approvals}</td>
                        <td>{item.rejections}</td>
                      </>
                    )}
                    {selectedReport === 'team-performance' && (
                      <>
                        <td>{item.employee}</td>
                        <td>{item.leavesTaken}</td>
                        <td>{item.onTimeCompletion}%</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="report-summary">
            <h3>Summary</h3>
            <p>
              {selectedReport === 'leave-usage' && 
                'This report shows monthly leave patterns and approval rates for your team.'}
              {selectedReport === 'team-performance' && 
                'Track how leave patterns affect individual and team performance metrics.'}
              {selectedReport === 'attendance' && 
                'Comprehensive attendance and absence tracking across your team.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerReports;