import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV, bufferCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_BATCH_ID = 101;
const ERR_INVALID_QUANTITY = 102;
const ERR_INVALID_DATE = 103;
const ERR_INVALID_HASH = 104;
const ERR_INVALID_MANUFACTURER = 105;
const ERR_BATCH_ALREADY_EXISTS = 106;
const ERR_BATCH_NOT_FOUND = 107;
const ERR_INVALID_METADATA = 108;
const ERR_AUTHORITY_NOT_VERIFIED = 109;
const ERR_INVALID_STATUS = 110;
const ERR_INVALID_LOCATION = 111;
const ERR_INVALID_TEMPERATURE = 112;
const ERR_MAX_BATCHES_EXCEEDED = 113;
const ERR_INVALID_UPDATE_PARAM = 114;

interface Batch {
  batchId: string;
  manufacturer: string;
  quantity: number;
  productionDate: number;
  expirationDate: number;
  compositionHash: Buffer;
  metadata: string;
  status: string;
  originLocation: string;
  storageTemperature: number;
  timestamp: number;
}

interface BatchUpdate {
  updateMetadata: string;
  updateStatus: string;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class DrugBatchRegistryMock {
  state: {
    nextBatchId: number;
    maxBatches: number;
    registrationFee: number;
    authorityContract: string | null;
    batches: Map<number, Batch>;
    batchUpdates: Map<number, BatchUpdate>;
    batchesById: Map<string, number>;
  } = {
    nextBatchId: 0,
    maxBatches: 10000,
    registrationFee: 500,
    authorityContract: null,
    batches: new Map(),
    batchUpdates: new Map(),
    batchesById: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextBatchId: 0,
      maxBatches: 10000,
      registrationFee: 500,
      authorityContract: null,
      batches: new Map(),
      batchUpdates: new Map(),
      batchesById: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setRegistrationFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.registrationFee = newFee;
    return { ok: true, value: true };
  }

  registerBatch(
    batchId: string,
    quantity: number,
    productionDate: number,
    expirationDate: number,
    compositionHash: Buffer,
    metadata: string,
    status: string,
    originLocation: string,
    storageTemperature: number
  ): Result<number> {
    if (this.state.nextBatchId >= this.state.maxBatches) return { ok: false, value: ERR_MAX_BATCHES_EXCEEDED };
    if (!batchId || batchId.length > 100) return { ok: false, value: ERR_INVALID_BATCH_ID };
    if (quantity <= 0) return { ok: false, value: ERR_INVALID_QUANTITY };
    if (productionDate < this.blockHeight) return { ok: false, value: ERR_INVALID_DATE };
    if (expirationDate < this.blockHeight) return { ok: false, value: ERR_INVALID_DATE };
    if (compositionHash.length === 0) return { ok: false, value: ERR_INVALID_HASH };
    if (metadata.length > 256) return { ok: false, value: ERR_INVALID_METADATA };
    if (!["active", "recalled", "expired"].includes(status)) return { ok: false, value: ERR_INVALID_STATUS };
    if (!originLocation || originLocation.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (storageTemperature < -20 || storageTemperature > 40) return { ok: false, value: ERR_INVALID_TEMPERATURE };
    if (!this.authorities.has(this.caller)) return { ok: false, value: ERR_INVALID_MANUFACTURER };
    if (this.state.batchesById.has(batchId)) return { ok: false, value: ERR_BATCH_ALREADY_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.registrationFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextBatchId;
    const batch: Batch = {
      batchId,
      manufacturer: this.caller,
      quantity,
      productionDate,
      expirationDate,
      compositionHash,
      metadata,
      status,
      originLocation,
      storageTemperature,
      timestamp: this.blockHeight,
    };
    this.state.batches.set(id, batch);
    this.state.batchesById.set(batchId, id);
    this.state.nextBatchId++;
    return { ok: true, value: id };
  }

  getBatch(id: number): Batch | null {
    return this.state.batches.get(id) || null;
  }

  updateBatch(id: number, newMetadata: string, newStatus: string): Result<boolean> {
    const batch = this.state.batches.get(id);
    if (!batch) return { ok: false, value: false };
    if (batch.manufacturer !== this.caller) return { ok: false, value: false };
    if (newMetadata.length > 256) return { ok: false, value: false };
    if (!["active", "recalled", "expired"].includes(newStatus)) return { ok: false, value: false };

    const updated: Batch = {
      ...batch,
      metadata: newMetadata,
      status: newStatus,
      timestamp: this.blockHeight,
    };
    this.state.batches.set(id, updated);
    this.state.batchUpdates.set(id, {
      updateMetadata: newMetadata,
      updateStatus: newStatus,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  getBatchCount(): Result<number> {
    return { ok: true, value: this.state.nextBatchId };
  }

  isBatchRegistered(batchId: string): Result<boolean> {
    return { ok: true, value: this.state.batchesById.has(batchId) };
  }
}

describe("DrugBatchRegistry", () => {
  let contract: DrugBatchRegistryMock;

  beforeEach(() => {
    contract = new DrugBatchRegistryMock();
    contract.reset();
  });

  it("registers a batch successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.registerBatch(
      "BATCH001",
      1000,
      100,
      200,
      Buffer.from("a".repeat(32)),
      "Paracetamol 500mg",
      "active",
      "FactoryA",
      25
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const batch = contract.getBatch(0);
    expect(batch?.batchId).toBe("BATCH001");
    expect(batch?.quantity).toBe(1000);
    expect(batch?.productionDate).toBe(100);
    expect(batch?.expirationDate).toBe(200);
    expect(batch?.compositionHash).toEqual(Buffer.from("a".repeat(32)));
    expect(batch?.metadata).toBe("Paracetamol 500mg");
    expect(batch?.status).toBe("active");
    expect(batch?.originLocation).toBe("FactoryA");
    expect(batch?.storageTemperature).toBe(25);
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate batch IDs", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerBatch(
      "BATCH001",
      1000,
      100,
      200,
      Buffer.from("a".repeat(32)),
      "Paracetamol 500mg",
      "active",
      "FactoryA",
      25
    );
    const result = contract.registerBatch(
      "BATCH001",
      2000,
      150,
      250,
      Buffer.from("b".repeat(32)),
      "Ibuprofen 200mg",
      "active",
      "FactoryB",
      20
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_BATCH_ALREADY_EXISTS);
  });

  it("rejects non-authorized manufacturer", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.authorities = new Set();
    const result = contract.registerBatch(
      "BATCH002",
      1000,
      100,
      200,
      Buffer.from("a".repeat(32)),
      "Paracetamol 500mg",
      "active",
      "FactoryA",
      25
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_MANUFACTURER);
  });

  it("rejects invalid batch ID", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.registerBatch(
      "",
      1000,
      100,
      200,
      Buffer.from("a".repeat(32)),
      "Paracetamol 500mg",
      "active",
      "FactoryA",
      25
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_BATCH_ID);
  });

  it("rejects invalid quantity", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.registerBatch(
      "BATCH003",
      0,
      100,
      200,
      Buffer.from("a".repeat(32)),
      "Paracetamol 500mg",
      "active",
      "FactoryA",
      25
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_QUANTITY);
  });

  it("rejects invalid production date", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.blockHeight = 150;
    const result = contract.registerBatch(
      "BATCH004",
      1000,
      100,
      200,
      Buffer.from("a".repeat(32)),
      "Paracetamol 500mg",
      "active",
      "FactoryA",
      25
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DATE);
  });

  it("rejects invalid status", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.registerBatch(
      "BATCH005",
      1000,
      100,
      200,
      Buffer.from("a".repeat(32)),
      "Paracetamol 500mg",
      "invalid",
      "FactoryA",
      25
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_STATUS);
  });

  it("updates a batch successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerBatch(
      "BATCH006",
      1000,
      100,
      200,
      Buffer.from("a".repeat(32)),
      "Paracetamol 500mg",
      "active",
      "FactoryA",
      25
    );
    const result = contract.updateBatch(0, "Updated Paracetamol 500mg", "recalled");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const batch = contract.getBatch(0);
    expect(batch?.metadata).toBe("Updated Paracetamol 500mg");
    expect(batch?.status).toBe("recalled");
    const update = contract.state.batchUpdates.get(0);
    expect(update?.updateMetadata).toBe("Updated Paracetamol 500mg");
    expect(update?.updateStatus).toBe("recalled");
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent batch", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updateBatch(99, "Updated Paracetamol 500mg", "recalled");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update by non-manufacturer", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerBatch(
      "BATCH007",
      1000,
      100,
      200,
      Buffer.from("a".repeat(32)),
      "Paracetamol 500mg",
      "active",
      "FactoryA",
      25
    );
    contract.caller = "ST3FAKE";
    const result = contract.updateBatch(0, "Updated Paracetamol 500mg", "recalled");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets registration fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setRegistrationFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.registrationFee).toBe(1000);
  });

  it("rejects registration fee change without authority", () => {
    const result = contract.setRegistrationFee(1000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("returns correct batch count", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerBatch(
      "BATCH008",
      1000,
      100,
      200,
      Buffer.from("a".repeat(32)),
      "Paracetamol 500mg",
      "active",
      "FactoryA",
      25
    );
    contract.registerBatch(
      "BATCH009",
      2000,
      150,
      250,
      Buffer.from("b".repeat(32)),
      "Ibuprofen 200mg",
      "active",
      "FactoryB",
      20
    );
    const result = contract.getBatchCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks batch existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerBatch(
      "BATCH010",
      1000,
      100,
      200,
      Buffer.from("a".repeat(32)),
      "Paracetamol 500mg",
      "active",
      "FactoryA",
      25
    );
    const result = contract.isBatchRegistered("BATCH010");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.isBatchRegistered("BATCH011");
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });


});