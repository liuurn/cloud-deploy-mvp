import { useState, useEffect, ChangeEvent } from "react";
import "./App.css";

// 1. 修改接口定义，匹配 HAL 格式
interface UserLink {
  href: string;
}

interface User {
  // id: number; // 后端原始 JSON 没有这个字段，我们需要手动解析出来
  username: string;
  gender: string;
  name: string;
  age: number;
  status: number;
  _links: {
    self: UserLink;
  };
  // 我们可以加一个前端辅助用的 id 字段
  _frontendId?: string; 
}

function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [newUser, setNewUser] = useState({
    username: `user_${Date.now()}`,
    gender: "male",
    name: `用户_${Date.now()}`,
    age: 18,
    status: 1
  });

  // 辅助函数：从 URL 中提取 ID 或相对路径
  // 解决 "http://.../be/users/1" -> "/be/users/1"
  const getRelativePath = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname; // 只取路径，避免 http/https 协议头的问题
    } catch (e) {
      return url;
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/be/users");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const usersData = data._embedded?.users || [];
      
      // 2. 为每个用户解析出一个 ID (如果后续需要 key)
      const processedUsers = usersData.map((u: User) => ({
         ...u,
         // 从 self href 中提取 ID: .../users/123 -> 123
         _frontendId: u._links.self.href.split('/').pop() 
      }));

      setUsers(processedUsers);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/be/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser)
      });
      if (!response.ok) throw new Error(`Status: ${response.status}`);
      
      // 重新拉取列表是最稳妥的，因为 POST 返回的数据可能不全
      setNewUser({
        username: `user_${Date.now()}`,
        gender: "male",
        name: `用户_${Date.now()}`,
        age: 18,
        status: 1
      });
      fetchUsers(); 
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to add user");
      setLoading(false);
    }
  };

  // 3. 修改删除逻辑：传入整个 user 对象
  const handleDeleteUser = async (user: User) => {
    setLoading(true);
    setError(null);
    try {
      // 核心修改：不自己拼 URL，而是直接用后端给的 _links.self.href
      // 并转化为相对路径，避免跨域或协议不一致
      const targetUrl = getRelativePath(user._links.self.href);

      const response = await fetch(targetUrl, {
        method: "DELETE"
      });
      
      if (!response.ok) throw new Error(`Status: ${response.status}`);
      
      // 乐观更新：直接在界面移除，不用等重新拉取
      setUsers((prev: User[]) => prev.filter((u: User) => u._links.self.href !== user._links.self.href));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to delete user");
      fetchUsers(); // 失败了就重新拉一次数据
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
      <div className="app-container">
        <div className="todo-app">
          <h1>用户列表</h1>
          
          <div className="user-form compact">
            <input
              type="text"
              placeholder="姓名"
              value={newUser.name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewUser({...newUser, name: e.target.value})}
            />
            <input
              type="number"
              placeholder="年龄"
              value={newUser.age}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewUser({...newUser, age: parseInt(e.target.value) || 18})}
            />
            <button onClick={handleAddUser} disabled={loading}>
              {loading ? "..." : "添加用户"}
            </button>
          </div>
          
          <div className="users-container">
            {!loading && !error && users.length > 0 && (
              <div className="users-list">
                {users.map((user) => (
                  // 使用 _links.self.href 作为 key，因为它是唯一的
                  <div key={user._links.self.href} className="user-item compact">
                    <div className="user-info">
                      <h4>姓名: {user.name}</h4>
                      <p>年龄: {user.age}</p>
                    </div>
                    <button
                      className="delete-user-btn"
                      // 传递整个 user 对象进去
                      onClick={() => handleDeleteUser(user)}
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
