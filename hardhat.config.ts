import { defineConfig } from "hardhat/config";
import toolbox from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

const compiler = {
  version: "0.8.34",
  ...(process.env.URBAN_SOLC ? { path: process.env.URBAN_SOLC } : {}),
  settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true },
};
export default defineConfig({
  plugins: [toolbox],
  solidity: { profiles: { default: compiler, production: compiler } },
  networks: {
    urbanLocal: { type: "edr-simulated", chainType: "l1", chainId: 31115 },
    localhost: { type: "http", chainType: "l1", chainId: 31115, url: "http://127.0.0.1:8555" },
  },
});
