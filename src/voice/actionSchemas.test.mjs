import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { GEV_ACTION_SCHEMAS, createActionTools } from './actionSchemas.js';
import { GEV_REALTIME_TOOLS } from '../../server/providers/openai/tools.js';

const stable = (value) =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, child]) => [key, stable(child)]),
        )
      : value;

test('the complete Realtime tool payload pins the additive analyst, satellite, AR, Local ADS-B and Cyber release', () => {
  const digest = createHash('sha256')
    .update(
      JSON.stringify(
        stable(
          GEV_REALTIME_TOOLS.filter((tool) => tool.name !== 'set_cyber_sonar'),
        ),
      ),
    )
    .digest('hex');
  assert.equal(
    digest,
    // Re-derived for the additive AR and `local-adsb` layer values and the
    // Cyber HUD layout; the separate sonar tool is excluded above.
    'e16056a8844f307d59e861573bc9f1eb3addb85ec9705ded2d810e8ec446c211',
  );
});

test('Realtime layer tools expose the AR experiences layer', () => {
  for (const name of ['set_layer_visibility', 'show_data_layers_menu']) {
    const layerIds = GEV_ACTION_SCHEMAS.find((tool) => tool.name === name)
      .parameters.properties.layerId.enum;
    assert.ok(layerIds.includes('ar-experiences'), `${name} omits AR`);
  }
});

test('descriptions customize wording without changing immutable shared arguments', () => {
  const descriptions = {
    fly_to_location: {
      description: 'Navigate',
      parameters: { properties: { query: { description: 'A place' } } },
    },
  };
  const tools = createActionTools(descriptions);
  const tool = tools.find((tool) => tool.name === 'fly_to_location');
  assert.equal(tool.description, 'Navigate');
  assert.equal(tool.parameters.properties.query.description, 'A place');
  assert.equal(tool.parameters.properties.query.type, 'string');
  tool.parameters.properties.query.type = 'number';
  assert.equal(
    createActionTools()[0].parameters.properties.query.type,
    'string',
  );
  assert.throws(() => {
    GEV_ACTION_SCHEMAS[0].parameters.properties.query.type = 'number';
  }, TypeError);
  assert.equal(
    JSON.stringify(GEV_ACTION_SCHEMAS).includes('"description"'),
    false,
  );
});

test('metadata cannot add tools, fields, types or enum values', () => {
  for (const descriptions of [
    { execute_shell: { description: 'not an action' } },
    {
      fly_to_location: {
        parameters: { properties: { description: 'new field' } },
      },
    },
    { fly_to_location: { $position: -1, description: 'invalid position' } },
    { fly_to_location: { name: 'other' } },
    {
      fly_to_location: {
        parameters: { properties: { arbitrary: { description: 'new field' } } },
      },
    },
    {
      fly_to_location: {
        parameters: { properties: { query: { type: 'number' } } },
      },
    },
    { fly_to_location: { parameters: { required: { 0: 'another' } } } },
    { fly_to_location: { description: { nested: 'invalid' } } },
  ])
    assert.throws(() => createActionTools(descriptions), TypeError);
});

test('all legacy action arguments are byte-identical after removing the deliberate additions', () => {
  const legacy = structuredClone(GEV_ACTION_SCHEMAS).filter(
    (tool) => !['next_satellite_pass', 'set_cyber_sonar'].includes(tool.name),
  );
  const layers = legacy.find((tool) => tool.name === 'analyst_query').parameters
    .properties.layers.items;
  layers.enum = layers.enum.filter(
    (key) =>
      ![
        'satellites',
        'local-datacenters',
        'local-dams',
        'fire-perimeters',
      ].includes(key),
  );
  // AR and Local ADS-B are additive set_layer_visibility enum values.
  const visibility = legacy.find((tool) => tool.name === 'set_layer_visibility')
    .parameters.properties.layerId;
  visibility.enum = visibility.enum.filter(
    (key) => !['ar-experiences', 'local-adsb', 'fire-perimeters'].includes(key),
  );
  for (const tool of legacy) {
    for (const value of Object.values(tool.parameters.properties)) {
      if (value.enum)
        value.enum = value.enum.filter(
          (key) => !['ar-experiences', 'fire-perimeters'].includes(key),
        );
    }
  }
  // Independently derived by executing trusted c9f9896 actionSchemas in the restricted container.
  const hud = legacy.find((tool) => tool.name === 'set_hud').parameters
    .properties.layout;
  hud.enum = hud.enum.filter((layout) => layout !== 'cyber');
  assert.equal(
    createHash('sha256').update(JSON.stringify(legacy)).digest('hex'),
    '820fff21658f6907e1010b2b79c5431a77f4e34afd2277d62d8de46c368b6f8c',
  );
});
