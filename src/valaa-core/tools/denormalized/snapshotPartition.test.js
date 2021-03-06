import { created, modified } from "~/valaa-core/command";
import { createCoreTestHarness } from "~/valaa-core/test/CoreTestHarness";
import { vRef } from "~/valaa-core/ValaaReference";

import snapshotPartition from "./snapshotPartition";

describe("The snapshot node walker", () => {
  const createBlockA = [
    created({ id: "A_grandparent", typeName: "TestThing" }),
    created({ id: "A_parent", typeName: "TestThing",
      initialState: { owner: vRef("A_grandparent", "children") },
    }),
    created({ id: "A_child1", typeName: "TestThing",
      initialState: { owner: vRef("A_parent", "children") },
    }),
  ];

  const createBlockARest = [
    created({ id: "A_child2", typeName: "TestThing",
      initialState: { owner: vRef("A_parent", "children") },
    }),
    created({ id: "A_childGlue", typeName: "TestGlue", initialState: {
      source: "A_child1", target: "A_child2",
    }, }),
    created({ id: "A_childDataGlue", typeName: "TestDataGlue", initialState: {
      source: "A_child1", target: "A_child2",
    }, }),
    modified({ id: "A_child1", typeName: "TestThing", sets: {
      targetDataGlues: ["A_childDataGlue"],
    }, }),
    modified({ id: "A_child2", typeName: "TestThing", sets: {
      sourceDataGlues: ["A_childDataGlue"],
    }, }),
  ];
  /* TODO(iridian): Extend the tests to use this data.
  const createBlockB = [
    created({ id: "B_grandparent", typeName: "TestThing" }),
    created({ id: "B_parent", typeName: "TestThing",
      initialState: { owner: vRef("B_grandparent", "children") },
    }),
    created({ id: "B_child1", typeName: "TestThing",
      initialState: { owner: vRef("B_parent", "children") },
    }),
    created({ id: "B_child2", typeName: "TestThing",
      initialState: { owner: vRef("B_parent", "children") },
    }),
    created({ id: "B_childDataGlue", typeName: "TestDataGlue", initialState: {
      source: "B_child1", target: "B_child2",
    }, }),
    created({ id: "B_childGlue", typeName: "TestGlue", initialState: {
      source: "B_child1", target: "B_child2",
    }, }),
  ];
  */
  beforeEach(() => {
  });

  it("Should survive a simple snapshotting roundtrip", async () => {
    const harness = createCoreTestHarness({ debug: 0 }, createBlockA, createBlockARest);
    const resultCommands = [];

    // console.log("Store before roundtrip", beaumpify(store.getState()));

    await snapshotPartition({
      partitionId: "A_grandparent",
      state: harness.corpus.getState(),
      schema: harness.ContentAPI.schema,
      onCreated: (id, typeName, getInitialState) => {
        const createdCommand = created({ id, typeName, initialState: getInitialState() });
        resultCommands.push(createdCommand);
      },
      onModified: (id, typeName, modifies) => {
        const modifiedCommand = modified({ id, typeName, ...modifies });
        resultCommands.push(modifiedCommand);
      },
    });
    const resultHarness = createCoreTestHarness({ debug: 0 }, resultCommands);
    expect(resultHarness.corpus.getState().toJS())
        .toEqual(harness.corpus.getState().toJS());
  });
});
