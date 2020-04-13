import Vue from 'vue'
import { library } from '@fortawesome/fontawesome-svg-core'
import {
  faTag, faSearch, faFileUpload,
  faCaretRight, faCaretDown, faCaretUp,
  faAngleDown, faAngleLeft, faAngleRight, faAngleUp, faArrowUp, faArrowDown
} from '@fortawesome/free-solid-svg-icons'
import { faEdit } from '@fortawesome/free-regular-svg-icons'
import { faGithub } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

library.add(
  faTag, faSearch, faFileUpload,
  faCaretRight, faCaretDown, faCaretUp,
  faAngleDown, faAngleLeft, faAngleRight, faAngleUp, faArrowUp, faArrowDown,
  faEdit,
  faGithub
)

Vue.component('fontawesome', FontAwesomeIcon)
