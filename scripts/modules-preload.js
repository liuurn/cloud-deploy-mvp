const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const semver = require("./semver");

// ===================== 可配置项（根据需求调整） =====================
const CONFIG = {
  // 需要匹配的包名前缀（支持多个）
  packagePrefixes: ["@jd", "@jdei", "@jdstars"],
  // tar包保存目录（相对于项目根目录）
  saveDir: ".joygen/preload-modules",
  // npm 源（默认官方源，可替换为淘宝源等）
  npmRegistry: "http://registry.m.jd.com",
};

// 执行主逻辑
main().catch((err) => {
  console.error(`❌ 脚本执行失败：${err.message}`);
  process.exit(1);
});

// ===================== 主逻辑 =====================
async function main(
  { projectRoot } = { projectRoot: process.env.JOYGEN_FE_PATH || process.cwd() }
) {
  console.log("\n==================== 开始处理 ====================");
  console.log(`📂 项目根目录：${projectRoot}`);
  const startTime = Date.now();
  let processedCount = 0; // 处理的包数量
  const pkgPath = path.join(projectRoot, "package.json");
  const saveDirAbs = path.join(projectRoot, CONFIG.saveDir);

  // 1. 检查package.json是否存在
  if (!fs.existsSync(pkgPath)) {
    console.error(`❌ 错误：未找到package.json，路径：${pkgPath}`);
    process.exit(1);
  }

  // 2. 创建保存目录
  if (!fs.existsSync(saveDirAbs)) {
    fs.mkdirSync(saveDirAbs, { recursive: true });
    console.log(`✅ 创建保存目录：${saveDirAbs}`);
  }

  // 3. 读取并解析package.json
  let pkgJson;
  try {
    const pkgContent = fs.readFileSync(pkgPath, "utf8");
    pkgJson = JSON.parse(pkgContent);
  } catch (err) {
    console.error(`❌ 解析package.json失败：${err.message}`);
    process.exit(1);
  }

  // 4. 提取需要处理的包（dependencies + devDependencies）
  const targetPackages = {};
  const allDeps = {
    ...(pkgJson.dependencies || {}),
    ...(pkgJson.devDependencies || {}),
    ...(pkgJson.peerDependencies || {}),
  };

  for (const [pkgName, version] of Object.entries(allDeps)) {
    if (!isResolvableSemver(version)) {
      console.log(`ℹ️ 跳过不可解析的版本号：${pkgName}@${version}`);
      continue;
    }

    // 匹配指定前缀的包
    const isMatch = CONFIG.packagePrefixes.some((prefix) =>
      pkgName.startsWith(prefix)
    );
    if (isMatch) {
      targetPackages[pkgName] = version;
    }
  }

  if (Object.keys(targetPackages).length === 0) {
    console.log("ℹ️ 未找到匹配的包，无需处理");
    process.exit(0);
  }

  console.log(
    `🔍 找到 ${Object.keys(targetPackages).length} 个需要处理的包：`,
    Object.keys(targetPackages)
  );

  // 5. 下载tar包并记录本地路径
  const localPackageMap = {};
  for (const [pkgName, version] of Object.entries(targetPackages)) {
    try {
      console.log(`📥 正在下载 ${pkgName}@${version}...`);
      // 获取tar包地址
      const [tarUrl, absVersion] = await getTarballUrl(pkgName, version);
      // 生成保存文件名（格式：包名-版本号.tgz，替换/@为_避免路径问题）
      const safePkgName = pkgName.replace(/\//g, "_").replace(/@/g, "");
      const tarFileName = `${safePkgName}-${absVersion}.tgz`;
      const tarSavePath = path.join(saveDirAbs, tarFileName);
      // 下载tar包
      await downloadTar(tarUrl, tarSavePath);
      // 生成相对路径（相对于package.json）
      const relativePath = path
        .relative(projectRoot, tarSavePath)
        .replace(/\\/g, "/");
      localPackageMap[pkgName] = `file:./${relativePath}`;
      processedCount++;
      console.log(`✅ 下载完成：${pkgName} -> ${tarSavePath}`);
    } catch (err) {
      console.log(`❌ 下载 ${pkgName} 失败：${err.message}`);
      process.exit(1);
    }
  }

  // 6. 修改package.json指向本地文件
  if (processedCount > 0) {
    // 更新dependencies
    if (pkgJson.dependencies) {
      for (const [pkgName, localPath] of Object.entries(localPackageMap)) {
        if (pkgJson.dependencies[pkgName]) {
          pkgJson.dependencies[pkgName] = localPath;
        }
      }
    }
    // 更新devDependencies
    if (pkgJson.devDependencies) {
      for (const [pkgName, localPath] of Object.entries(localPackageMap)) {
        if (pkgJson.devDependencies[pkgName]) {
          pkgJson.devDependencies[pkgName] = localPath;
        }
      }
    }
    // 更新devDependencies
    if (pkgJson.peerDependencies) {
      for (const [pkgName, localPath] of Object.entries(localPackageMap)) {
        if (pkgJson.peerDependencies[pkgName]) {
          pkgJson.peerDependencies[pkgName] = localPath;
        }
      }
    }

    // 保存修改后的package.json（格式化）
    try {
      fs.writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2), "utf8");
      console.log(`✅ 已更新package.json，指向本地tar包`);
    } catch (err) {
      console.error(`❌ 保存package.json失败：${err.message}`);
      process.exit(1);
    }
  }

  // 7. 输出统计结果
  const costTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("\n==================== 处理结果 ====================");
  console.log(`✅ 成功处理包数量：${processedCount} 个`);
  console.log(`⏱️  总耗时：${costTime} 秒`);
  console.log(`📁 tar包保存目录：${saveDirAbs}`);
  if (processedCount > 0) {
    console.log(`🔧 已修改的包及本地路径：`);
    for (const [pkgName, localPath] of Object.entries(localPackageMap)) {
      console.log(`   - ${pkgName}: ${localPath}`);
    }
  }
}
// ===================== 工具函数 =====================
/**
 * 下载tar包
 * @param {string} tarUrl tar包地址
 * @param {string} savePath 保存路径
 * @returns {Promise<void>}
 */
function downloadTar(tarUrl, savePath) {
  return new Promise((resolve, reject) => {
    const client = tarUrl.startsWith("https") ? https : http;
    const fileStream = fs.createWriteStream(savePath);

    client
      .get(tarUrl, (response) => {
        // 处理重定向
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          downloadTar(response.headers.location, savePath)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(
            new Error(`下载失败：${tarUrl}，状态码：${response.statusCode}`)
          );
          fileStream.close();
          return;
        }

        response.pipe(fileStream);
        fileStream.on("finish", () => {
          fileStream.close();
          resolve();
        });
      })
      .on("error", (err) => {
        fs.unlink(savePath, () => {}); // 删除已下载的文件
        reject(new Error(`下载出错：${err.message}`));
      });
  });
}

/**
 * 获取包的tar包地址
 * @param {string} packageName 包名
 * @param {string} version 版本号
 * @returns {Promise<string>} tar包地址
 */
async function getTarballUrl(packageName, version) {
  // 需要先解析绝对版本号
  let absVersion = getFixedVersion(version);
  if (!absVersion) {
    // 首选调用接口获取所有的版本号
    const res = await get(`http://npm.jd.com/api/package/${packageName}`);
    // 3. 根据你提供的数据结构：res.data.package.versions
    // 假设 versions 是 ['1.0.0', '2.1.0', '2.2.5'] 这种数组
    const versionList = res?.data?.package?.versions || [];
    console.log(`✅ 找到 ${versionList.length} 个版本号`);
    const versionStrings = versionList.map((item) => item[0]);
    absVersion = semver.maxSatisfying(versionStrings, version);
  }
  if (!absVersion) {
    console.error(`❌ 未找到符合条件的版本号：${version}`);
    process.exit(1);
  }
  // http://registry.m.jd.com/@jdei/antd/download/@jdei/antd-2.0.20.tgz
  // 拼接npm源地址
  return [
    `${CONFIG.npmRegistry}/${packageName}/download/${packageName}-${absVersion}.tgz`,
    absVersion,
  ];
}

function getFixedVersion(input) {
  // 1. 尝试验证是否为绝对版本号
  // valid() 会过滤掉 ^, ~, *, x 等范围符号
  const cleanVersion = semver.valid(input);

  if (cleanVersion) {
    // 如果是绝对版本号，直接返回，不需要去查列表对比
    console.log("检测到绝对版本号，直接使用:", cleanVersion);
    return cleanVersion;
  }

  // 2. 如果返回 null，说明它是一个范围（Range），需要后续去 versions 列表里找
  console.log("检测到范围表达式，需要查询版本列表:", input);
  return null;
}

/**
 * 极简 GET 请求客户端
 * @param {string} url
 * @returns {Promise<any>}
 */
function get(url) {
  const client = url.startsWith("https") ? https : http;
  return new Promise((resolve, reject) => {
    client
      .get(url, (res) => {
        let data = "";

        // 检查状态码
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`Status Code: ${res.statusCode}`));
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
  // validRange 会过滤掉路径、非法字符串，仅保留 ^, ~, *, >, <, x 等
  return semver.validRange(range) !== null;
}
