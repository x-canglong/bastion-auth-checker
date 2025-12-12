import { execSync } from "child_process";
import path from "path";

const server = "115.190.106.118";
const port = 56;
const username = "root";
const privateKey = "D:\\115.190.106.118_id_ed25519";
const remoteDir = "/opt/html/bastion-auth-checker/";
const distDir = path.resolve("dist");

function run(cmd) {
  console.log(`\n>>> ${cmd}\n`);
  execSync(cmd, { stdio: "inherit" });
}

console.log("==========================================");
console.log(`   上传 dist 到服务器（SSH密钥模式）：${remoteDir}`);
console.log("==========================================");

// 1. 打包
run("pnpm run build");

// 2. 自动上传
const uploadCommand = `scp -P ${port} -i "${privateKey}" -r "${distDir}/*" ${username}@${server}:${remoteDir}`;

run(uploadCommand);

console.log("\n🎉 部署完成（SSH 密钥登录）！");