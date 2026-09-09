import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { parse, compileScript } from '@vue/compiler-sfc'
import * as vue from 'vue'

// Compile the real component script, supplying an in-memory API in place of HTTP.
function createTable(api, rows = []) {
  const source = readFileSync(
    new URL('../src/components/EditableReportTable.vue', import.meta.url),
    'utf8',
  )
  const { descriptor } = parse(source)
  const script = compileScript(descriptor, { id: 'report-table-test' })
    .content.replace(/^import .* from .*$/gm, '')
    .replace('export default', 'return')
  const component = new Function('computed', 'ref', 'watch', 'api', 'currentUser', script)(
    vue.computed,
    vue.ref,
    vue.watch,
    api,
    vue.ref({ id: 1 }),
  )
  const events = []
  const props = vue.reactive({
    config: {
      endpoint: 'staff-elections',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'elected_on', type: 'date' },
      ],
    },
    reportId: 1,
    rows,
  })
  const state = component.setup(props, {
    expose() {},
    emit(name, data) {
      events.push([name, data])
      if (name === 'changed') props.rows = data
    },
  })
  return { state, props, events }
}

test('retry after a later row fails does not recreate an already saved row', async () => {
  let posts = 0
  let fail = true
  const api = {
    async post(url, body) {
      posts++
      if (body.name === 'Second' && fail) throw new Error('Temporary failure')
      return { data: { ...body, id: posts } }
    },
    async patch(url, body) {
      return { data: { ...body, id: Number(url.split('/').at(-1)) } }
    },
  }
  const { state, props } = createTable(api)
  state.addRow()
  state.draft.value[0].name = 'First'
  state.addRow()
  state.draft.value[1].name = 'Second'
  await state.save()
  assert.equal(state.editing.value, true)
  assert.equal(state.draft.value[0].id, 1)
  assert.equal(props.rows.length, 1)
  fail = false
  await state.save()
  assert.equal(posts, 3)
  assert.equal(props.rows.length, 2)
  assert.equal(state.editing.value, false)
})

test('date values returned by the API can be edited and saved', async () => {
  let saved
  const { state } = createTable(
    {
      async patch(url, body) {
        saved = body
        return { data: { ...body, id: 1 } }
      },
    },
    [{ id: 1, name: 'First', elected_on: '2026-09-09T00:00:00.000Z' }],
  )
  state.beginEdit()
  assert.equal(state.draft.value[0].elected_on, '2026-09-09')
  await state.save()
  assert.equal(saved.elected_on, '2026-09-09')
})
