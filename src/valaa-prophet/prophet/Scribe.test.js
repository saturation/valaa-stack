// @flow

import { created, transacted } from "~/valaa-core/command/index";
import { createPartitionURI } from "~/valaa-core/tools/PartitionURI";

import { createScribe, clearScribeDatabases } from "~/valaa-prophet/test/ProphetTestHarness";

import { stringFromUTF8ArrayBuffer } from "~/valaa-tools/id/contentId";

import { openDB, getFromDB, getKeysFromDB, expectStoredInDB }
    from "~/valaa-tools/html5/InMemoryIndexedDBUtils";

const URI = "test-partition:";
const sharedURI = "valaa-shared-content";

afterEach(async () => {
  await clearScribeDatabases();
});

describe("Scribe", () => {
  const simpleCommand = created({ id: "Some entity", typeName: "Entity" });

  const simpleTransaction = transacted({
    actions: [
      created({ id: "Some relation", typeName: "Relation" }),
      created({ id: "Some other entity", typeName: "Entity" }),
    ],
  });

  it("Keeps track of the count of commands executed", async () => {
    let commandsCounted = 0;
    const commandCountCallback = (count) => {
      commandsCounted = count;
    };

    const scribe = createScribe(commandCountCallback);
    await scribe.initialize();
    const uri = createPartitionURI(URI);

    expect(commandsCounted).toBe(0);

    const connection = await scribe.acquirePartitionConnection(uri, {});
    expect(commandsCounted).toBe(0);

    await connection.claimCommandEvent(simpleCommand);
    expect(commandsCounted).toBe(1);

    // A transaction counts as one command
    await connection.claimCommandEvent(simpleTransaction);
    expect(commandsCounted).toBe(2);
  });

  it("Stores events/commands in the database", async () => {
    const scribe = createScribe();
    await scribe.initialize();
    const uri = createPartitionURI(URI);

    const connection = await scribe.acquirePartitionConnection(uri, {});
    const database = await openDB(URI);

    // Adds an entity and checks that it has been stored
    let claimResult = await connection.claimCommandEvent(simpleCommand);
    await claimResult.finalizeLocal();
    await expectStoredInDB(simpleCommand, database, "commands",
        connection._getLastCommandEventId());

    // Runs a transaction and confirms that it has been stored
    claimResult = await connection.claimCommandEvent(simpleTransaction);
    await claimResult.finalizeLocal();
    await expectStoredInDB(simpleTransaction, database, "commands",
        connection._getLastCommandEventId());
  });

  const mediaContents = [
    "Hello world",
    "",
    "abcdefghijklmnopqrstuvwxyzäöåABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÅøØæÆ¤§½",
    "f".repeat(262144), // 256 KB
  ];

  it("Stores (and returns) utf-8 strings correctly", async () => {
    const scribe = createScribe();
    await scribe.initialize();
    const uri = createPartitionURI(URI);

    const connection = await scribe.acquirePartitionConnection(uri, {});
    const sharedDB = await openDB(sharedURI);

    for (const mediaContent of mediaContents) {
      const preparedBlob = connection.prepareBlob(mediaContent, "Some media");
      const blobId = await preparedBlob.persistProcess;

      const blobKeys = await getKeysFromDB(sharedDB, "blobs");
      expect(blobKeys).toContain(blobId);

      const bufferKeys = await getKeysFromDB(sharedDB, "buffers");
      expect(bufferKeys).toContain(blobId);

      const restoredBuffer = await getFromDB(sharedDB, "buffers", blobId);
      const restoredContent = stringFromUTF8ArrayBuffer(restoredBuffer.buffer);
      expect(restoredContent).toEqual(mediaContent);
    }
  });

  it("Populates a brand new connection to an existing partition with its pre-existing commands",
  async () => {
    const scribe = createScribe();
    await scribe.initialize();
    const uri = createPartitionURI(URI);

    const firstConnection = await scribe.acquirePartitionConnection(uri, {});

    let claimResult = firstConnection.claimCommandEvent(simpleCommand);
    await claimResult.finalizeLocal();

    claimResult = firstConnection.claimCommandEvent(simpleTransaction);
    await claimResult.finalizeLocal();

    const lastCommandId = firstConnection._getLastCommandEventId();
    expect(lastCommandId).toBeGreaterThan(0);
    firstConnection.disconnect();

    const secondConnection = await scribe.acquirePartitionConnection(uri, {});
    expect(secondConnection._getLastCommandEventId()).toBe(lastCommandId);
  });

  const commandList = [
    created({ id: "Entity A", typeName: "Entity" }),
    created({ id: "Entity B", typeName: "Entity" }),
    created({ id: "Entity C", typeName: "Entity" }),
    created({ id: "Entity D", typeName: "Entity" }),
    created({ id: "Entity E", typeName: "Entity" }),
    created({ id: "Entity F", typeName: "Entity" }),
  ];

  it("Ensures command IDs are stored in a crescent order", async () => {
    const scribe = createScribe();
    await scribe.initialize();
    const uri = createPartitionURI(URI);

    const connection = await scribe.acquirePartitionConnection(uri, {});
    let oldCommandId;
    let newCommandId = connection._getLastCommandEventId();

    for (const command of commandList) {
      const claimResult = connection.claimCommandEvent(command);
      await claimResult.finalizeLocal();

      oldCommandId = newCommandId;
      newCommandId = connection._getLastCommandEventId();
      expect(oldCommandId).toBeLessThan(newCommandId);
    }
  });
});
