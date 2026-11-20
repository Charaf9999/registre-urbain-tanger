import { artifacts, network } from "hardhat";
import { writeFileSync, mkdirSync } from "node:fs";

const { ethers } = await network.create();
const [admin] = await ethers.getSigners();
const registry = await ethers.deployContract("UrbanIssueRegistry");
await registry.waitForDeployment();
const receipt = await registry.deploymentTransaction()!.wait();
if (!receipt || receipt.status !== 1) throw Error("Deployment unconfirmed");
const deployment = {
  network: "Hardhat local",
  chainId: Number((await ethers.provider.getNetwork()).chainId),
  rpc: "http://127.0.0.1:8555",
  address: await registry.getAddress(),
  municipality: admin.address,
  transaction: receipt.hash,
  block: receipt.blockNumber,
};
const { abi } = await artifacts.readArtifact("UrbanIssueRegistry");
mkdirSync("frontend/src", { recursive: true });
writeFileSync(
  "frontend/src/registry.json",
  JSON.stringify({ ...deployment, abi }, null, 2) + "\n"
);
console.log(JSON.stringify(deployment, null, 2));
