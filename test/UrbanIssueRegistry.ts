import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();
const base = {
  issueId: "CITY-2026-001",
  issueType: "StreetLight",
  location: "Avenue Mohammed V",
  description: "Lampadaire éteint",
  reportDay: 20776,
  priority: 2,
  reportedBy: "Citizen01",
  assignedTo: "",
  status: 0,
};
const key = ethers.id(base.issueId);

async function setup() {
  const [city, citizen] = await ethers.getSigners();
  const registry = await ethers.deployContract("UrbanIssueRegistry");
  await registry.waitForDeployment();
  return { registry, city, citizen };
}
describe("UrbanIssueRegistry", function () {
  it("désigne la municipalité et démarre avec un registre vide", async () => {
    const { registry, city } = await setup();
    expect(await registry.municipality()).to.equal(city.address);
    expect(await registry.issueCount()).to.equal(0);
  });
  it("publie une déclaration citoyenne, son événement et sa date de bloc", async () => {
    const { registry, citizen } = await setup();
    const tx = await registry.connect(citizen).createIssue(base);
    await expect(tx)
      .to.emit(registry, "IssueRecorded")
      .withArgs(key, base.issueId, citizen.address, false, 0);
    const block = await ethers.provider.getBlock((await tx.wait())!.blockNumber);
    const [entry] = await registry.getHistory(base.issueId);
    expect(entry.timestamp).to.equal(block!.timestamp);
    expect(entry.actor).to.equal(citizen.address);
    expect(await registry.idAt(0)).to.equal(base.issueId);
    expect((await registry.getIssue(base.issueId)).reportedBy).to.equal(base.reportedBy);
  });
  it("refuse les identifiants inconnus et en double", async () => {
    const { registry } = await setup();
    await expect(registry.getHistory(base.issueId)).to.be.revertedWith("Unknown ID");
    await expect(registry.getIssue(base.issueId)).to.be.revertedWith("Unknown ID");
    await registry.createIssue(base);
    await expect(registry.createIssue(base)).to.be.revertedWith("Duplicate ID");
  });
  it("valide l'identifiant, les textes et la date sur chaîne", async () => {
    const { registry } = await setup();
    for (const change of [
      { issueId: "ville 1" },
      { location: "   " },
      { reportedBy: "" },
      { reportDay: 1 },
      { description: "a".repeat(281) },
    ]) {
      await expect(registry.createIssue({ ...base, ...change })).to.revert(ethers);
    }
  });
  it("refuse une déclaration citoyenne déjà affectée", async () => {
    const { registry, citizen } = await setup();
    await expect(
      registry.connect(citizen).createIssue({ ...base, assignedTo: "T1" })
    ).to.revert(ethers);
  });
  it("réserve les interventions au portefeuille municipal", async () => {
    const { registry, citizen } = await setup();
    await registry.createIssue(base);
    await expect(
      registry.connect(citizen).assignTeam(base.issueId, "T1", "Mission")
    ).to.be.revertedWith("Municipality only");
    await expect(
      registry.connect(citizen).updateStatus(base.issueId, 2, "Début")
    ).to.be.revertedWith("Municipality only");
  });
  it("conserve les cinq étapes, leurs acteurs, équipes et commentaires", async () => {
    const { registry, city, citizen } = await setup();
    await registry.connect(citizen).createIssue(base);
    await expect(registry.assignTeam(base.issueId, "Équipe A", "Inspection"))
      .to.emit(registry, "TeamAssigned")
      .withArgs(key, city.address, "Équipe A", 1, "Inspection");
    for (const [status, comment] of [
      [2, "Début"],
      [3, "Réparé"],
      [4, "Vérifié"],
    ] as const) {
      await expect(registry.updateStatus(base.issueId, status, comment))
        .to.emit(registry, "StatusChanged")
        .withArgs(key, city.address, status, comment);
    }
    const history = await registry.connect(citizen).getHistory(base.issueId);
    expect(history.map((e: any) => Number(e.status))).to.deep.equal([0, 1, 2, 3, 4]);
    expect(history[0].actor).to.equal(citizen.address);
    expect(history[4].actor).to.equal(city.address);
    expect(history[4].team).to.equal("Équipe A");
    expect(history[4].comment).to.equal("Vérifié");
    expect((await registry.getIssue(base.issueId)).status).to.equal(4);
    expect(await registry.countByStatus(4)).to.equal(1);
    expect(await registry.countByStatus(0)).to.equal(0);
    await expect(registry.updateStatus(base.issueId, 2, "Retour")).to.revert(ethers);
    await expect(registry.assignTeam(base.issueId, "T2", "Retour")).to.revert(ethers);
  });
  it("bloque les sauts, retours et commentaires vides", async () => {
    const { registry } = await setup();
    await registry.createIssue(base);
    await expect(registry.updateStatus(base.issueId, 1, "Sans équipe")).to.revert(ethers);
    await expect(registry.assignTeam(base.issueId, "", "Affecter")).to.revert(ethers);
    await registry.assignTeam(base.issueId, "T1", "Diagnostic");
    await expect(registry.updateStatus(base.issueId, 3, "Saut")).to.revert(ethers);
    await expect(registry.updateStatus(base.issueId, 2, " ")).to.revert(ethers);
    await expect(registry.updateStatus(base.issueId, 0, "Retour")).to.revert(ethers);
  });
  it("réaffecte en cours sans perdre le statut ni l'ancienne équipe", async () => {
    const { registry } = await setup();
    await registry.createIssue(base);
    await registry.assignTeam(base.issueId, "T1", "Diagnostic");
    await registry.updateStatus(base.issueId, 2, "Début");
    await registry.assignTeam(base.issueId, "T2", "Renfort");
    const h = await registry.getHistory(base.issueId);
    expect(h[1].team).to.equal("T1");
    expect(h[3].team).to.equal("T2");
    expect(h[3].status).to.equal(2);
  });
  it("importe un lot citoyen et annule tout le lot en cas de doublon", async () => {
    const { registry, citizen } = await setup();
    await expect(registry.connect(citizen).importIssues([base, base])).to.be.revertedWith(
      "Duplicate ID"
    );
    expect(await registry.issueCount()).to.equal(0);
    await registry.connect(citizen).importIssues([base, { ...base, issueId: "CITY-2026-002" }]);
    expect(await registry.issueCount()).to.equal(2);
    expect((await registry.getHistory(base.issueId))[0].action).to.equal(1);
  });
  it("réserve les reprises d'état et d'équipe à la municipalité", async () => {
    const { registry, citizen } = await setup();
    const snapshot = { ...base, status: 3, assignedTo: "UrbanTeam01" };
    await expect(registry.connect(citizen).importIssues([snapshot])).to.be.revertedWith(
      "Municipality only"
    );
    await expect(
      registry.connect(citizen).importIssues([{ ...base, assignedTo: "T1" }])
    ).to.revert(ethers);
    await expect(registry.importIssues([{ ...snapshot, assignedTo: "" }])).to.be.revertedWith(
      "Team required"
    );
    await registry.importIssues([snapshot]);
    const h = await registry.getHistory(base.issueId);
    expect(h.length).to.equal(1);
    expect(h[0].status).to.equal(3);
    expect(h[0].action).to.equal(1);
  });
  it("accepte le modèle Reported avec équipe lors d'un import municipal", async () => {
    const { registry } = await setup();
    await registry.importIssues([{ ...base, assignedTo: "UrbanTeam01" }]);
    const row = await registry.getIssue(base.issueId);
    expect(row.status).to.equal(0);
    expect(row.assignedTo).to.equal("UrbanTeam01");
  });
  it("impose les limites de lot", async () => {
    const { registry } = await setup();
    await expect(registry.importIssues([])).to.be.revertedWith("Batch size 1..10");
    await expect(registry.importIssues(Array(11).fill(base))).to.be.revertedWith(
      "Batch size 1..10"
    );
  });
});
