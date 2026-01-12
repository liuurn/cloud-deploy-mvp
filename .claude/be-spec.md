# Java Spring Boot 业务模块开发模板

## 🚀 启动策略
开始工作前，检查 `src/main/java/com/jd/joygen/unisandbox` 目录：
- **空目录/仅有启动类**: 这是一个新的业务需求。你需要根据需求描述，初始化 Controller/Service/Repository/Entity 的目录结构。
- **有其他业务文件**: 已有业务模块。请遵循现有的包结构和命名规范进行增量开发。

## 🏗️ 项目架构说明 (关键)
**本项目是大型后端工程的一个“业务插件”模块。**
后续流程会将此代码库与核心工程模板（Core Template）进行融合构建。

### 🚫 禁止事项
1.  **禁止创建启动类**: 不要编写 `@SpringBootApplication` 启动入口类（复用工程自带的 `UnisandboxApplication`）。
2.  **禁止基础设施配置**: 不要编写数据库连接 (`spring.datasource.*`)、Redis 连接等系统级配置。
3.  **禁止引入非常规依赖**: 默认环境已包含 Web, Spring Data JPA, Data Rest, Lombok, Hutool。如需额外依赖，请先询问。

### ✅ 推荐做法
1.  **专注业务逻辑**: 只编写 Controller, Service, Repository, Entity, DTO/VO。
2.  **利用 Spring Data REST**: 对于简单的单表 CRUD，优先利用 `@RepositoryRestResource` 自动暴露接口，减少样板代码。
3.  **Lombok**: 必须使用 Lombok (`@Data`, `@RequiredArgsConstructor`, `@Slf4j`) 简化代码。

## 🛠️ 模板契约 (Template Contract)
虽然你看不到以下类，但它们在编译期和运行期**可能存在**（基于约定）：

| 类/注解 | 全限定名 (假设) | 用途 | 调用示例 |
| :--- | :--- | :--- | :--- |
| **统一响应** | (无，直接由 REST 框架处理) | Spring Data REST 自动包装 HAL 格式响应 | (框架自动处理) |
| **基础实体** | (自定义) | 建议手动创建基类或在实体中包含通用字段 | `@MappedSuperclass public abstract class BaseEntity...` |
| **工具类** | `cn.hutool.core.*` | Hutool 工具包 | `StrUtil.isBlank(str)`, `DateUtil.now()` |

## 📂 标准文件结构
基础包名为: `com.jd.joygen.unisandbox.{business}`
(请根据当前业务上下文替换 `{business}`)

```text
src/main/java/com/jd/joygen/unisandbox/order/  # 示例：订单模块
├── controller/
│   └── OrderController.java       # (可选) 仅当 Data REST 无法满足需求时的自定义复杂接口
├── service/
│   ├── OrderService.java          # 接口
│   └── impl/
│       └── OrderServiceImpl.java  # 业务逻辑核心
├── repository/
│   └── OrderRepository.java       # JPA Repository 接口 (extends JpaRepository)
├── model/
│   ├── entity/
│   │   └── Order.java             # 数据库实体 (@Entity)
│   ├── dto/
│   │   └── OrderCreateDTO.java    # 接收前端参数 (Input)
│   └── vo/
│       └── OrderDetailVO.java     # 返回前端视图 (Output)
```

## ⚠️ 代码组织强制要求
| 内容 | 放置位置 | 规则说明 |
| :--- | :--- | :--- |
| **数据库交互** | `repository` | 必须继承 `JpaRepository`。简单的查询使用方法名衍生查询。 |
| **接口暴露** | `repository` | 使用 `@RepositoryRestResource` 快速暴露 REST 接口。 |
| **复杂逻辑** | `service` | 涉及多表事务、复杂计算时，在 Service 层实现并在 Controller 中调用。 |
| **实体定义** | `model/entity` | 使用 JPA 注解 (`@Entity`, `@Table`, `@Id`)。 |

## 📝 开发规范
**技术栈**:
- Java 17
- Spring Boot 3.x
- **Spring Data JPA** (ORM)
- **Spring Data REST** (快速接口)
- Lombok

## 🔌 缓存与 Redis 兼容性策略 (Lite vs Full)
本项目支持两种部署/编译模式：
1.  **Lite 模式** (开发/演示): 使用 H2 数据库，**无 Redis 依赖**。
2.  **Full 模式** (生产): 使用 PostgreSQL，包含 Redis。

**为了保证代码在两套环境下的兼容性，请严格遵守以下缓存使用规范：**

### ❌ 禁止直接使用 Redis 客户端
*   **禁止** 注入 `RedisTemplate`, `StringRedisTemplate` 或 `Jedis`。
*   原因：Lite 模式下没有这些类，会导致编译失败。

### ✅ 使用 Spring Cache 抽象
*   **必须** 使用 Spring Cache 注解 (`@Cacheable`, `@CachePut`, `@CacheEvict`) 进行缓存操作。
*   **原理**: 
    *   在 **Lite** 模式下，Spring Boot 自动回退到 `SimpleCacheManager` (基于 `ConcurrentHashMap` 的内存缓存)。
    *   在 **Full** 模式下，配置了 Redis 后，Spring Boot 会自动切换为 `RedisCacheManager`。
*   **示例**:
    ```java
    @Service
    public class ProductServiceImpl implements ProductService {
        
        @Override
        @Cacheable(value = "products", key = "#id")
        public Product getProductById(Long id) {
            // 模拟耗时数据库查询
            return productRepository.findById(id).orElseThrow();
        }

        @Override
        @CacheEvict(value = "products", key = "#id")
        public void updateProduct(Long id, ProductDTO dto) {
            // 更新逻辑...
        }
    }
    ```

## 编码规范
- **命名**: 类名 PascalCase (如 `OrderService`)，方法/变量 camelCase。
- **依赖注入**: 禁止使用 `@Autowired`。必须使用 Lombok 的 `@RequiredArgsConstructor` 进行构造器注入。
- **Controller 规范**: 仅在需要自定义复杂业务逻辑接口时创建 Controller。常规 CRUD 交给 Repository。

## 💡 代码示例

### 1. Repository (Data REST 方式)
```java
@RepositoryRestResource(path = "orders")
public interface OrderRepository extends JpaRepository<Order, Long> {
    // 自动暴露 GET /orders, POST /orders, GET /orders/{id} 等
    
    // 自定义查询方法，自动暴露为 /orders/search/findByStatus?status=...
    List<Order> findByStatus(@Param("status") Integer status);
}
```

### 2. Service Impl (带缓存)
```java
@Service
@Slf4j
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {

    private final ProductRepository productRepository;

    @Override
    @Transactional
    public void createOrder(OrderCreateDTO dto) {
        // 业务逻辑...
    }
    
    @Override
    @Cacheable(value = "order_stats", key = "#userId")
    public OrderStatsVO getUserOrderStats(Long userId) {
        // 复杂统计逻辑
        return stats;
    }
}