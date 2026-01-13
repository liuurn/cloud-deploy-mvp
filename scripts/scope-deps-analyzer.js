const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const semver = require("./semver");

// ===================== 可配置项（根据需求调整） =====================
const CONFIG = {
  // 需要匹配的包名前缀（支持多个）
  packagePrefixes: ["@jd", "@jdei", "@jdstars"],
  // npm 源（默认官方源，可替换为淘宝源等）
  npmRegistry: "http://registry.m.jd.com",
  // 递归深度限制
  maxDepth: 5,
};

/**
 * 分析指定npm scope前缀下的所有依赖（包括间接依赖）
 * @param {string} projectRoot - 项目根目录
 * @param {string} [scope] - npm scope，如 '@jd'（已废弃，现在使用配置中的packagePrefixes）
 * @returns {Promise<string[]>} - 包含所有匹配scope前缀的依赖包名数组
 */
async function analyzeScopeDependencies(projectRoot, scope) {
  // 废弃参数警告
  if (scope) {
    console.log(
      `⚠️  scope 参数已废弃，现在使用配置中的 packagePrefixes: ${CONFIG.packagePrefixes.join(
        ", "
      )}`
    );
  }

  console.log(`\n==================== 开始分析依赖 ====================`);
  console.log(`📂 项目根目录：${projectRoot}`);
  console.log(`🔍 分析前缀：${CONFIG.packagePrefixes.join(", ")}`);

  // 检查package.json是否存在
  const pkgPath = path.join(projectRoot, "package.json");
  if (!fs.existsSync(pkgPath)) {
    throw new Error(`❌ 未找到package.json，路径：${pkgPath}`);
  }

  // 读取并解析package.json
  const pkgContent = fs.readFileSync(pkgPath, "utf8");
  const pkgJson = JSON.parse(pkgContent);

  // 合并所有依赖字段
  const allDependencies = {
    ...(pkgJson.dependencies || {}),
    ...(pkgJson.devDependencies || {}),
    ...(pkgJson.peerDependencies || {}),
    ...(pkgJson.optionalDependencies || {}),
  };

  // 已处理的包集合，避免循环依赖
  const processedPackages = new Set();
  // 匹配scope的依赖集合
  const scopeDependencies = new Set();

  // 递归分析依赖
  async function analyzeDependencies(deps, currentDepth = 1) {
    // 检查递归深度
    if (currentDepth > CONFIG.maxDepth) {
      console.log(`⚠️  达到最大递归深度 ${CONFIG.maxDepth}，停止递归`);
      return;
    }

    for (const [pkgName, version] of Object.entries(deps)) {
      // 检查是否已处理
      if (processedPackages.has(pkgName)) {
        continue;
      }

      // 标记为已处理
      processedPackages.add(pkgName);

      // 检查是否匹配任何前缀
      const isMatch = CONFIG.packagePrefixes.some((prefix) =>
        pkgName.startsWith(prefix)
      );
      if (isMatch) {
        scopeDependencies.add(pkgName);
        console.log(`✅ 找到匹配的依赖：${pkgName}@${version}`);

        // 跳过不可解析的版本号
        if (!isResolvableSemver(version)) {
          console.log(`ℹ️  跳过不可解析的版本号：${pkgName}@${version}`);
          return;
        }

        try {
          // 获取包的详细信息，包括其依赖
          const pkgInfo = await getPackageInfo(pkgName, version);
          if (pkgInfo && pkgInfo.dependencies) {
            // 递归分析子依赖
            console.log(`🔍 分析 ${pkgName} 的依赖，深度：${currentDepth + 1}`);
            await analyzeDependencies(pkgInfo.dependencies, currentDepth + 1);
          }
        } catch (err) {
          console.warn(`⚠️  无法获取 ${pkgName} 的依赖信息：${err.message}`);
        }
      } else {
        console.log(`ℹ️  跳过非匹配前缀的包：${pkgName}@${version}`);
      }
    }
  }

  // 过滤出需要处理的初始依赖（只处理匹配前缀的包）
  const initialDeps = {};
  for (const [pkgName, version] of Object.entries(allDependencies)) {
    // 匹配指定前缀的包
    const isMatch = CONFIG.packagePrefixes.some((prefix) =>
      pkgName.startsWith(prefix)
    );
    if (isMatch) {
      initialDeps[pkgName] = version;
    }
  }

  // 如果没有匹配的依赖，直接停止处理
  if (Object.keys(initialDeps).length === 0) {
    console.log(`ℹ️  未找到匹配的包，无需处理`);
    return [];
  }

  console.log(
    `🔍 找到 ${Object.keys(initialDeps).length} 个需要处理的初始依赖：`,
    Object.keys(initialDeps)
  );

  // 开始分析
  await analyzeDependencies(initialDeps);

  // 转换为数组并排序
  const result = Array.from(scopeDependencies).sort();

  console.log(`\n==================== 分析完成 ====================`);
  console.log(`📊 共找到 ${result.length} 个匹配的依赖：`);
  result.forEach((pkg) => console.log(`  - ${pkg}`));

  return result;
}

/**
 * 获取包的详细信息
 * @param {string} packageName - 包名
 * @param {string} version - 版本号或版本范围
 * @returns {Promise<Object>} - 包的详细信息，包括dependencies
 */
async function getPackageInfo(packageName, version) {
  // 获取包的所有版本信息
  const res = await get(`${CONFIG.npmRegistry}/${packageName}`);
  const pkgData = res || {};

  // 解析出所有版本字符串
  const versions = pkgData.versions ? Object.keys(pkgData.versions) : [];
  if (!versions.length) {
    throw new Error(`未找到 ${packageName} 的版本信息`);
  }

  // 找到符合版本范围的最新版本
  const matchedVersion = semver.maxSatisfying(versions, version);
  if (!matchedVersion) {
    throw new Error(`未找到符合条件的版本号：${version}`);
  }

  // 获取该版本的详细信息
  const pkgVersionData = pkgData.versions[matchedVersion];
  if (!pkgVersionData) {
    throw new Error(`未找到 ${packageName}@${matchedVersion} 的详细信息`);
  }

  console.log(`✅ 找到 ${packageName} 的匹配版本：${matchedVersion}`);
  return pkgVersionData;
}

/**
 * 检查版本号是否可解析
 * @param {string} range - 版本号或版本范围
 * @returns {boolean} - 是否可解析
 */
function isResolvableSemver(range) {
  if (!range) return false;

  const r = range.trim().toLowerCase();

  // 1. 排除常见的非 npm 协议头
  const protocols = [
    "http:",
    "https:",
    "file:",
    "git:",
    "git+ssh:",
    "git+http:",
    "git+https:",
    "link:",
    "portal:",
  ];
  if (protocols.some((p) => r.startsWith(p))) return false;

  // 2. 排除 GitHub 简写格式 (例如: "user/repo" 或 "github:user/repo")
  if (r.includes("/") || r.startsWith("github:")) return false;

  // 3. 最终校验：如果 semver 能识别为有效范围，则是我们需要处理的
  return semver.validRange(range) !== null;
}

/**
 * 极简 GET 请求客户端
 * @param {string} url
 * @returns {Promise<any>} - 响应数据
 */
function get(url) {
  const client = url.startsWith("https") ? https : http;
  return new Promise((resolve, reject) => {
    client
      .get(url, (res) => {
        let data = "";

        // 处理重定向
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          get(res.headers.location).then(resolve).catch(reject);
          return;
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`请求失败：${url}，状态码：${res.statusCode}`));
          return;
        }

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            // 尝试解析 JSON，如果不是 JSON 则返回原始字符串
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        });
      })
      .on("error", reject);
  });
}

/**
 * 主函数
 */
async function main() {
  try {
    // 默认参数
    const projectRoot = process.argv[2] || process.cwd();

    // 执行分析
    const dependencies = await analyzeScopeDependencies(projectRoot);

    // 输出结果到文件
    const outputPath = path.join(projectRoot, ".joygen", "scope-deps.json");
    const outputDir = path.dirname(outputPath);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(
      outputPath,
      JSON.stringify(
        {
          packagePrefixes: CONFIG.packagePrefixes,
          dependencies,
          timestamp: new Date().toISOString(),
          count: dependencies.length,
          maxDepth: CONFIG.maxDepth,
        },
        null,
        2
      ),
      "utf8"
    );

    console.log(`\n✅ 结果已保存到：${outputPath}`);
    return dependencies;
  } catch (err) {
    console.error(`❌ 脚本执行失败：${err.message}`);
    process.exit(1);
  }
}

// 如果直接运行脚本，执行主函数
if (require.main === module) {
  main();
}

module.exports = { analyzeScopeDependencies };
