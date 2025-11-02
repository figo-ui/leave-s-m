import React, { useState } from 'react';
import { User, UserFormData, } from '../../types';
import './UserManagement.css';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([
    {
      id: 1,
      name: 'John Doe',
      email: 'john@company.com',
      role: 'employee',
      department: 'Engineering',
      status: 'active'
    },
    {
      id: 2,
      name: 'Jane Smith',
      email: 'jane@company.com',
      role: 'manager',
      department: 'Engineering',
      status: 'active'
    },
    {
      id: 3,
      name: 'Bob Johnson',
      email: 'bob@company.com',
      role: 'hr-admin',
      department: 'HR',
      status: 'active'
    }
  ]);

  const [showAddUser, setShowAddUser] = useState<boolean>(false);
  const [newUser, setNewUser] = useState<UserFormData>({
    name: '',
    email: '',
    role: 'employee',
    department: ''
  });

  const handleAddUser = (e: React.FormEvent): void => {
    e.preventDefault();
    const user: User = {
      ...newUser,
      id: users.length + 1,
      status: 'active'
    };
    setUsers([...users, user]);
    setNewUser({ name: '', email: '', role: 'employee', department: '' });
    setShowAddUser(false);
  };

  const handleDeleteUser = (userId: number): void => {
    setUsers(users.filter(user => user.id !== userId));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    setNewUser(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="user-management">
      <div className="page-header">
        <h2>User Management</h2>
        <button 
          className="add-user-btn"
          onClick={() => setShowAddUser(true)}
        >
          Add User
        </button>
      </div>

      {showAddUser && (
        <div className="add-user-modal">
          <div className="modal-content">
            <h3>Add New User</h3>
            <form onSubmit={handleAddUser}>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  name="name"
                  value={newUser.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={newUser.email}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select
                  name="role"
                  value={newUser.role}
                  onChange={handleInputChange}
                >
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="hr-admin">HR Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label>Department</label>
                <input
                  type="text"
                  name="department"
                  value={newUser.department}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="submit" className="save-btn">Save</button>
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={() => setShowAddUser(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>
                  <span className={`role-badge role-${user.role}`}>
                    {user.role}
                  </span>
                </td>
                <td>{user.department}</td>
                <td>
                  <span className={`status-badge status-${user.status}`}>
                    {user.status}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button className="edit-btn">Edit</button>
                    <button 
                      className="delete-btn"
                      onClick={() => handleDeleteUser(user.id)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement;