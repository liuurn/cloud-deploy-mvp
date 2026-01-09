import { useState, useEffect } from "react";
import "./App.css";

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

interface User {
  id: number;
  name: string;
  email: string;
  // 根据API实际返回字段调整
}

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputText, setInputText] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddTodo = () => {
    if (inputText.trim()) {
      const newTodo: Todo = {
        id: Date.now(),
        text: inputText.trim(),
        completed: false,
      };
      setTodos([...todos, newTodo]);
      setInputText("");
    }
  };

  const handleToggleTodo = (id: number) => {
    setTodos(
      todos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const handleDeleteTodo = (id: number) => {
    setTodos(todos.filter((todo) => todo.id !== id));
  };

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
      setUsers(data);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to fetch users"
      );
    } finally {
      setLoading(false);
    }
  };

  // 在组件挂载时调用API
  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="app-container">
      <div className="todo-app">
        <h1>Todo List</h1>
        <div className="todo-input">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Add a new todo..."
            onKeyPress={(e) => e.key === "Enter" && handleAddTodo()}
          />
          <button onClick={handleAddTodo}>Add</button>
        </div>
        <div className="todo-list">
          {todos.map((todo) => (
            <div
              key={todo.id}
              className={`todo-item ${todo.completed ? "completed" : ""}`}
            >
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => handleToggleTodo(todo.id)}
              />
              <span className="todo-text">{todo.text}</span>
              <button
                className="delete-btn"
                onClick={() => handleDeleteTodo(todo.id)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
        {todos.length === 0 && (
          <p className="empty-message">No todos yet. Add one above!</p>
        )}
      </div>

      {/* 用户列表部分 */}
      <div className="users-section">
        <h2>Users</h2>
        {loading && <p>Loading users...</p>}
        {error && <p className="error-message">Error: {error}</p>}
        {!loading && !error && users.length === 0 && <p>No users found.</p>}
        {!loading && !error && users.length > 0 && (
          <div className="users-list">
            {users.map((user) => (
              <div key={user.id} className="user-item">
                <h3>{user.name}</h3>
                <p>{user.email}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
