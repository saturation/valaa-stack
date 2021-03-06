import { created, transacted, fieldsSet } from "~/valaa-core/command/index";
import { vRef } from "~/valaa-core/ValaaReference";
import { createPartitionURI } from "~/valaa-core/tools/PartitionURI";

import { createProphetOracleHarness } from "~/valaa-prophet/test/ProphetTestHarness";

import { openDB, expectStoredInDB } from "~/valaa-tools/html5/InMemoryIndexedDBUtils";

const testAuthorityURI = "valaa-test:";
// const sharedURI = "valaa-shared-content";

function vCrossRef (rawId, partitionRawId = rawId) {
  const uri = createPartitionURI("valaa-test:", partitionRawId);
  return vRef(rawId, null, null, uri);
}

let harness = null;
afterEach(() => {
  harness.cleanup();
  harness = null;
});


describe("Prophet", () => {
  const createPartitionCommand = created({
    id: vCrossRef("test_partition", "test_partition"),
    typeName: "Entity",
    initialState: {
      name: "Test Partition",
      partitionAuthorityURI: testAuthorityURI,
    },
  });

  it("sets up a connection and creates a partition", async () => {
    harness = await createProphetOracleHarness({}, [createPartitionCommand]);
    expect(harness.testPartitionConnection).toBeTruthy();
    expect(harness.testPartitionConnection.isConnected())
        .toEqual(true);
    expect(harness.prophet.run(vRef("test_partition"), "name"))
        .toEqual("Test Partition");
  });

  const basicCommands = [
    created({
      id: "Entity A",
      typeName: "Entity",
      initialState: {
        name: "Entity A",
        owner: vRef("test_partition", "unnamedOwnlings"),
      }
    }),
    created({
      id: "Entity B",
      typeName: "Entity",
      initialState: {
        name: "Entity B",
        owner: vRef("test_partition", "unnamedOwnlings"),
      }
    }),
    created({
      id: "Entity C",
      typeName: "Entity",
      initialState: {
        name: "Entity C",
        owner: vRef("test_partition", "unnamedOwnlings"),
      }
    }),
  ];

  it("counts prophet actions correctly on the scribe", async () => {
    harness = await createProphetOracleHarness({});
    const partitionURI = createPartitionURI(testAuthorityURI, "test_partition");

    const prophetConnection = await harness.prophet.acquirePartitionConnection(partitionURI);
    // Wrong:
    // const scribeConnection = await scribe.acquirePartitionConnection(partitionURI, {});
    //
    // Right:
    const scribeConnection = prophetConnection.getScribeConnection();

    let oldCommandId;
    let newCommandId = scribeConnection._getLastCommandEventId();

    const commandList = [createPartitionCommand].concat(...basicCommands);
    for (const command of commandList) {
      oldCommandId = newCommandId;

      const claimResult = await harness.claim(command);
      await claimResult.getFinalEvent();

      newCommandId = scribeConnection._getLastCommandEventId();
      expect(oldCommandId).toBeLessThan(newCommandId);
    }
  });

  it("Stores the contents of the actions on the scribe correctly", async () => {
    harness = await createProphetOracleHarness({});
    const partitionURI = createPartitionURI(testAuthorityURI, "test_partition");

    const prophetConnection = await harness.prophet.acquirePartitionConnection(partitionURI);
    const scribeConnection = prophetConnection.getScribeConnection();
    const database = await openDB(partitionURI.toString());

    const commandList = [createPartitionCommand].concat(...basicCommands);
    for (const command of commandList) {
      const claimResult = await harness.claim(command);
      const finalEvent = await claimResult.getFinalEvent();
      const eventId = scribeConnection._getLastCommandEventId();
      await expectStoredInDB(finalEvent, database, "commands", eventId);
    }
  });

  const freezePartitionCommand = transacted({
    actions: [fieldsSet({ id: vRef("test_partition"), typeName: "Entity" }, { isFrozen: true })],
  });

  const lateCommand = created({
    id: "Entity Late",
    typeName: "Entity",
    initialState: {
      name: "A late entity",
      owner: vRef("test_partition", "unnamedOwnlings"),
    }
  });

  it("Rejects commands executed after a freeze command", async () => {
    harness = await createProphetOracleHarness({});
    const partitionURI = createPartitionURI(testAuthorityURI, "test_partition");
    await harness.prophet.acquirePartitionConnection(partitionURI);

    // Run commands up until the partition is frozen
    const commandsUntilFreeze = [createPartitionCommand, freezePartitionCommand];
    for (const command of commandsUntilFreeze) {
      const claimResult = await harness.claim(command);
      await claimResult.getFinalEvent();
    }

    // Attempt to run an action post-freeze and expect complaints
    expect(() => harness.claim(lateCommand)).toThrow(/Cannot modify frozen.*test_partition/);
  });
});
