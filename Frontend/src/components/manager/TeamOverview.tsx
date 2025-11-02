import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import './TeamOverview.css';

const TeamOverview: React.FC = () => {
  // Mock data - replace with actual API data
  const teamMembers = [
    { id: 1, name: 'John Doe', position: 'Software Engineer', leavesTaken: 12, remainingLeaves: 18, onLeave: false },
    { id: 2, name: 'Jane Smith', position: 'UI/UX Designer', leavesTaken: 8, remainingLeaves: 22, onLeave: true },
    { id: 3, name: 'Mike Johnson', position: 'Project Manager', leavesTaken: 15, remainingLeaves: 15, onLeave: false },
    { id: 4, name: 'Sarah Wilson', position: 'QA Engineer', leavesTaken: 5, remainingLeaves: 25, onLeave: false },
  ];

  const upcomingLeaves = [
    { id: 1, employee: 'Jane Smith', type: 'Annual Leave', dates: '2024-02-01 to 2024-02-05', status: 'Approved' },
    { id: 2, employee: 'Mike Johnson', type: 'Sick Leave', dates: '2024-02-10', status: 'Pending' },
  ];

  return (
    <div className="team-overview">
      <div className="page-header">
        <h1>Team Overview</h1>
        <p>Manage and monitor your team's leave schedules</p>
      </div>

      <div className="overview-grid">
        <div className="team-stats">
          <div className="stat-card">
            <h3>Team Size</h3>
            <span className="stat-number">12</span>
          </div>
          <div className="stat-card">
            <h3>On Leave Today</h3>
            <span className="stat-number">2</span>
          </div>
          <div className="stat-card">
            <h3>Pending Requests</h3>
            <span className="stat-number">5</span>
          </div>
        </div>

        <div className="team-members">
          <h2>Team Members</h2>
          <div className="members-grid">
            {teamMembers.map((member) => (
              <div key={member.id} className={`member-card ${member.onLeave ? 'on-leave' : ''}`}>
                <div className="member-info">
                  <h4>{member.name}</h4>
                  <p>{member.position}</p>
                  <div className="leave-stats">
                    <span>Leaves Taken: {member.leavesTaken}</span>
                    <span>Remaining: {member.remainingLeaves}</span>
                  </div>
                </div>
                {member.onLeave && <div className="leave-indicator">On Leave</div>}
              </div>
            ))}
          </div>
        </div>

        <div className="upcoming-leaves">
          <h2>Upcoming Leaves</h2>
          <div className="leaves-list">
            {upcomingLeaves.map((leave) => (
              <div key={leave.id} className="leave-item">
                <div className="leave-info">
                  <strong>{leave.employee}</strong>
                  <span>{leave.type}</span>
                  <small>{leave.dates}</small>
                </div>
                <span className={`status ${leave.status.toLowerCase()}`}>
                  {leave.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamOverview;