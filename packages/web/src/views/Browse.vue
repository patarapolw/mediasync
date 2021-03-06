<template lang="pug">
.container
  b-navbar.elevation-1
    template(slot="start")
      form.field(@submit.prevent="onSearch" style="display: flex; align-items: center;")
        p.control.has-icons-left
          input.input(
            type="search" v-model="q" placeholder="Search..."
            autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          )
          span.icon.is-small.is-left
            fontawesome(icon="search")
    template(slot="end")
      b-navbar-item(tag="div")
        .buttons
          router-link.button(to="/edit") New
          button.button(@click="load()") Reload
          b-dropdown(aria-role="list" position="is-bottom-left")
            button.button(:disabled="checked.length === 0" slot="trigger")
              span(style="margin-right: 0.5em") Batch Edit
              b-icon(icon="angle-down")
            b-dropdown-item(aria-role="listitem")
              p(role="button" @click="isEditTagsDialog = true") Edit tags
            b-dropdown-item(aria-role="listitem")
              p(role="button" @click="doDelete") Delete
  .columns
    .column
      b-table.query-table(
        :data="items"
        :loading="isLoading"
        detailed

        sticky-header
        :height="tableHeight"

        :selected.sync="selected"
        @select="openItem($event)"

        checkable
        :checked-rows.sync="checked"
        @check="onTableChecked"

        backend-sorting
        :default-sort="[sort.key, sort.type]"
        @sort="onSort"
      )
        template(slot-scope="props")
          b-table-column(v-for="h in headers" :key="h.field" :field="h.field"
              :label="h.label" :width="h.width" :sortable="h.sortable")
            span(v-if="Array.isArray(props.row[h.field])")
              b-taglist
                b-tag(v-for="t in props.row[h.field]" :key="t") {{t}}
            div(v-else style="max-height: 200px; overflow: scroll;")
              span.wrap {{props.row[h.field] | format}}
        template(slot="detail" slot-scope="props")
          .container(style="max-width: 800px; max-height: 300px; overflow: scroll;")
            .content(
              v-html="toHTML(props.row)"
              style="max-height: 300px; overflow: scroll"
              @click="openItem(props.row.key)"
            )
  b-modal(:active.sync="isEditTagsDialog" :width="500")
    .card
      header.card-header
        .card-header-title Edit tags
      .card-content
        b-field
          b-taginput(
            v-model="tagList" ellipsis icon="tag" placeholder="Add tags"
            autocomplete open-on-focus @typing="getFilteredTags"
            :data="filteredTags" allow-new
          )
        .buttons
          div(style="flex-grow: 1;")
          button.button(@click="editTags") Save
          button.button(@click="isEditTagsDialog = false") Close
</template>

<script lang="ts">
import { Component, Vue, Watch, Prop } from 'vue-property-decorator'
import dayjs from 'dayjs'
import axios, { AxiosInstance } from 'axios'
import hbs from 'handlebars'
import firebase from 'firebase/app'

import 'firebase/firebase-firestore'

import { normalizeArray, stringSorter, deepMerge } from '../assets/utils'
import { Matter } from '../assets/make-html/matter'
import MakeHtml from '../assets/make-html'
import { parseQ } from '../assets/qsearch'

@Component
export default class Query extends Vue {
  selected: any = null
  checked: any[] = []

  items: any[] = []
  allTags: string[] | null = null
  filteredTags: string[] = []
  tagList: string[] = []
  sort = {
    key: '_updatedAt',
    type: 'desc'
  }

  isLoading = false
  count = 0
  isEditTagsDialog = false
  newTags = ''
  q = ''

  headers = [
    { label: 'Name', field: 'name', width: 200, sortable: true },
    { label: 'Markdown', field: 'markdown', width: 300 },
    { label: 'Tag', field: 'tag', width: 200 }
  ]

  perPage = 20
  ctx: any = {}

  tableHeight = 300

  async mounted () {
    this.load()

    const qTable = this.$el.querySelector('.query-table .table-wrapper') as HTMLDivElement
    this.tableHeight = innerHeight - qTable.getBoundingClientRect().top - 10

    qTable.addEventListener('scroll', (evt) => {
      if (qTable.scrollTop + qTable.clientHeight === qTable.scrollHeight) {
        this.load()
      }
    })
  }

  onSearch () {
    this.$router.push({
      path: '/browse',
      query: {
        q: this.q
      }
    })
  }

  toHTML (item: any) {
    const makeHtml = new MakeHtml(item.key)
    return makeHtml.getHTML(hbs.compile(this.ctx[item.key].markdown || '')({
      [item.key]: item,
      ...this.ctx
    }))
  }

  async load (reset?: boolean) {
    this.$set(this, 'checked', [])
    const q = normalizeArray(this.$route.query.q) || ''

    let c = parseQ(firebase.firestore().collection('metadata'), q)
      .orderBy(this.sort.key, this.sort.type as any)

    if (this.items.length > 0) {
      c = c.startAfter(this.items[this.items.length - 1][this.sort.key])
    }

    const docs = await c
      .limit(this.perPage)
      .get()

    if (reset) {
      this.items = []
    }

    docs.forEach((d) => {
      const data = d.data()
      this.items.push({
        id: d.id,
        ...data
      })
    })

    await Promise.all(this.items
      .map((el) => this.onCtxChange(deepMerge([el.id], el.ref))))

    this.$set(this, 'items', this.items)
  }

  onSort (key: string, type: 'desc' | 'asc') {
    this.sort.key = key
    this.sort.type = (type as string)
    this.load(true)
  }

  async doDelete () {
    this.$buefy.dialog.confirm({
      title: 'Deleting media',
      message: 'Are you sure you want to <b>delete</b> the selected posts?',
      confirmText: 'Delete',
      type: 'is-danger',
      hasIcon: true,
      onConfirm: async () => {
        await Promise.all(this.checked.map((el) => el.id).map(async (id) => {
          return firebase.firestore().collection('metadata').doc(id).delete()
        }))

        setTimeout(() => {
          this.load(true)
        }, 100)
      }
    })
  }

  async getFilteredTags (text: string) {
    if (!this.allTags) {
      const doc = await firebase.firestore().collection('tag').doc('all').get()
      this.allTags = (doc.data() || {}).tags || []
    }

    this.filteredTags = this.allTags!.filter((t) => {
      return t.toLocaleLowerCase().includes(text.toLocaleLowerCase())
    })
  }

  openItem (it: any) {
    this.$router.push({
      path: '/edit',
      query: {
        id: it.id
      }
    })
  }

  onTableChecked (checked: any[]) {
    this.tagList = Array.from(new Set(checked
      .map((el) => el.tag)
      .filter((t) => t)
      .reduce((a, b) => [...a!, ...b!], [])!))

    this.$set(this, 'tagList', this.tagList)
  }

  editTags () {
    // this.$nextTick(async () => {
    //   const api = await this.getApi()
    //   await api.patch('/api/edit/', {
    //     keys: this.checked.map((el) => el.key),
    //     set: {
    //       tag: this.tagList
    //     }
    //   })

    //   this.isEditTagsDialog = false

    //   this.load()
    // })
  }

  async onCtxChange (ctx: any) {
    if (!ctx || typeof ctx !== 'object') {
      return
    }

    if (Array.isArray(ctx)) {
      ctx = ctx.reduce((prev, c) => ({ ...prev, [c]: null }), {})
    }

    await Promise.all(Object.entries<any>(ctx).map(async ([key, data]) => {
      if (typeof data !== 'undefined' && !this.ctx[key]) {
        if (!data) {
          const r = await firebase.firestore().collection('metadata').doc(key).get()
          const data = r.data()

          if (data) {
            const { header, content } = new Matter().parse(data.markdown || '')
            this.ctx[key] = header
            this.ctx[key].markdown = content
          }
        } else {
          if (typeof data === 'string') {
            this.ctx[key] = (await axios.get(data)).data
          } else if (data.url) {
            this.ctx[key] = (await axios(data)).data
          }
        }
      }
    }))
  }
}
</script>

<style lang="scss">
.query-table {
  tbody {
    tr {
      cursor: pointer;
    }

    tr:hover {
      background-color: lightblue;
    }
  }
}

.wrap {
  word-break: break-all;
}
</style>
