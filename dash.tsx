import { useState, useEffect } from "react";
import axios from "axios";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  lastLogin: Date;
}

interface Stats {
  totalUsers: number;
  activeUsers: number;
  revenue: number;
}

export default function Dashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    axios.get("/api/users").then((res) => {
      setUsers(res.data);
      setLoading(false);
    });
    axios.get("/api/stats").then((res) => {
      setStats(res.data);
    });
  }, []);

  const deleteUser = (id: string) => {
    axios.delete(`/api/users/${id}`).then(() => {
      setUsers(users.filter((u) => u.id !== id));
    });
  };

  const promoteUser = (id: string) => {
    axios.put(`/api/users/${id}`, { role: "admin" }).then(() => {
      setUsers(users.map((u) => (u.id === id ? { ...u, role: "admin" } : u)));
    });
  };

  return (
    <div>
      <h1>Admin Dashboard</h1>
      {loading && <p>Loading...</p>}
      <div>
        <p>Total Users: {stats?.totalUsers}</p>
        <p>Active: {stats?.activeUsers}</p>
        <p>Revenue: {stats?.revenue}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Last Login</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{user.role}</td>
              <td>{user.lastLogin.toString()}</td>
              <td>
                <button onClick={() => deleteUser(user.id)}>Delete</button>
                <button onClick={() => promoteUser(user.id)}>Promote</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
