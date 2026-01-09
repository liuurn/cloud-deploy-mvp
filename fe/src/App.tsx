import { useState, useEffect } from "react";
import "./App.css";

interface User {
  id: number;
  username: string;
  gender: string;
  name: string;
  age: number;
  status: number;
}

function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 用户表单状态
  const [newUser, setNewUser] = useState({
    username: `user_${Date.now()}`, // 设置默认用户名，包含时间戳确保唯一性
    gender: "male", // 保持后台需要的字段
    name: `用户_${Date.now()}`, // 设置默认姓名，使用时间戳确保唯一性
    age: 18,
    status: 1 // 保持后台需要的字段
  });

  // 获取用户数据的API调用
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/be/users");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // 处理HAL格式响应，从_embedded.users中提取用户数据
      const usersData = data._embedded?.users || [];
      setUsers(usersData);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to fetch users"
      );
    } finally {
      setLoading(false);
    }
  };

  // 添加用户的API调用
  const handleAddUser = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/be/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(newUser)
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const addedUser = await response.json();
      // 处理添加用户后的响应，可能是直接的用户对象或HAL格式
      const userToAdd = addedUser.id ? addedUser : null;
      if (userToAdd) {
        setUsers([...users, userToAdd]);
        // 重置表单
        setNewUser({
          username: `user_${Date.now()}`, // 生成新的唯一用户名
          gender: "male",
          name: `用户_${Date.now()}`, // 生成新的唯一姓名
          age: 18,
          status: 1
        });
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to add user"
      );
    } finally {
      setLoading(false);
      fetchUsers()
    }
  };

  // 删除用户的API调用
  const handleDeleteUser = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/be/users/${id}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      // 从本地状态中移除删除的用户
      setUsers(users.filter(user => user.id !== id));
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to delete user"
      );
    } finally {
      setLoading(false);
      fetchUsers()
    }
  };

  // 在组件挂载时调用API
  useEffect(() => {
    fetchUsers();
  }, []);

  return (
      <div className="app-container">
        <div className="todo-app">
          <h1>用户列表</h1>
          
          {/* 添加用户表单 */}
          <div className="user-form compact">
            <input
              type="text"
              placeholder="姓名"
              value={newUser.name}
              onChange={(e) => setNewUser({...newUser, name: e.target.value})}
            />
            <input
              type="number"
              placeholder="年龄"
              value={newUser.age}
              onChange={(e) => setNewUser({...newUser, age: parseInt(e.target.value) || 18})}
            />
            <button onClick={handleAddUser} disabled={loading}>
              {loading ? "添加中..." : "添加用户"}
            </button>
          </div>
          
          {/* 用户列表部分 */}
          <div className="users-container">
            {loading && <p>加载用户中...</p>}
            {error && <p className="error-message">错误: {error}</p>}
            {!loading && !error && users.length === 0 && <p>暂无用户数据</p>}
            {!loading && !error && users.length > 0 && (
              <div className="users-list">
                {users.map((user) => (
                  <div key={user.id} className="user-item compact">
                    <div className="user-info">
                      <h4>{user.name}</h4>
                      <p>年龄: {user.age}</p>
                    </div>
                    <button
                      className="delete-user-btn"
                      onClick={() => handleDeleteUser(user.id)}
                      disabled={loading}
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
  );
}

export default App;
