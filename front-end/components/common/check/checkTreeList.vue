<template>
  <div class="searchBar">
    <el-input
      v-model="keywordOri"
      placeholder="props.searchPlacehold"
      :suffix-icon="Search"
      :clearable="true"
      class="search-tree_input"
      @keyup.enter="search"
      @clear="clearSearch"
    />
  </div>
  
  <Transition
    name="fade"
    mode="out-in">
    <div
      v-show="childrenShowTreeData.length === treeDataList.length"
      class="total_controllBar">
      <el-checkbox
        :indeterminate="indeterminate"
        :model-value="selected"
        @update:model-value="selected = !selected">
        {{ t('st_select_all') }}
      </el-checkbox>
    </div>
  </Transition>

  <Transition
    name="fade"
    mode="out-in">
    <div
      v-show="!isEmpty(childrenShowTreeData)"
      class="body"
      @matchHit="matchHit"
      @change="childrenCheckedChanged">
      <template
        v-for="(item, index) in treeDataList"
        :key="item.name + item.label">
        <checkTree
          v-model:treeData="treeDataList[index]"
          v-model:isReset="isReset"
          :parentChecked="selected"
          :parentIndeterminate="indeterminate"></checkTree>
      </template>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import checkTree from './checkTree.vue'
import {
  type ModelRef,
  type Ref,
  type ComputedRef,
  type ComponentPublicInstance,
  PropType,
  ref,
  computed,
  provide,
  watch,
  nextTick,
  onErrorCaptured
} from 'vue'
import { $t } from '@/common/utils/i18n-util'
import * as i18n from '@/card/target-management/i18n/i18n.json'
import { type TreeData, CanNotSearchEnum } from '../types'
import { debounce, type DebouncedFunc, isEmpty } from 'lodash'
import { logUtils } from '@/common/utils'

// 国际化
const t = (str: string, arg = {}) => {
  return $t(i18n, str, arg)
}

const props = defineProps({
  searchPlacehold: String,
  canNotSearch: { type: String as PropType<CanNotSearchEnum>, required: false },
  isHideLabel: { type: Boolean, required: false, default: false },
  maxLevel: {
    type: Number,
    required: false,
    default: Number.MAX_SAFE_INTEGER,
    validator: (value: number) => {
      if (value > 0) {
        return true
      } else {
        return false
      }
    }
  }
})

const treeDataList: ModelRef<TreeData[]> = defineModel('treeDataList', { required: true })

//控制最大层数
provide('maxLevel', props.maxLevel)

//控制非查找字段
provide('canNotSearch', props.canNotSearch)

//控制是否隐藏标签
provide('isHideLabel', props.isHideLabel)

/****************以下是关键词搜索****************/
const keywordOri: Ref<string> = ref('')
const keyword: Ref<string> = ref('')
const hightRangeArr: Ref<Range[]> = ref([])
const clearSearchFlag: Ref<boolean> = ref(false)

//重置高光状态
function refreshHignLight(): void {
  keywordOri.value = ''
  keyword.value = ''
  hightRangeArr.value = []
  // @ts-expect-error: 鸿蒙App支持CSS.highlights.delete，忽略此处的错误
  CSS.highlights.delete('text-highlight')
}

function search(): void {
  //搜索
  keyword.value = keywordOri.value
  hightRangeArr.value = []
  if (isEmpty(keyword.value)) {
    refreshHignLight()
  }
}

provide('clearSearchFlag', clearSearchFlag)
function clearSearch(): void {
  refreshHignLight()
  clearSearchFlag.value = true
  nextTick(() => {
    clearSearchFlag.value = false
  })
}

provide('keyword', keyword)
provide('hightRangeArr', hightRangeArr)

//冒泡在本一次宏事件，利用防抖在下一次宏事件处理，将多次冒泡事件合并为一次
const highlightFunc: DebouncedFunc<() => void> = debounce(() => {
  // @ts-expect-error: 鸿蒙App支持CSS.highlights.set，忽略此处的错误
  CSS.highlights.set('text-highlight', new Highlight(...hightRangeArr.value))
}, 0)

//匹配命中冒泡事件
function matchHit(event: CustomEvent): void {
  event.stopPropagation()
  highlightFunc()
}
/****************以上是关键词搜索****************/

/****************以下是监听全选选中状态****************/
const indeterminate: Ref<boolean> = ref(false)
const selected: Ref<boolean> = ref(false)

watch(selected, newSelected => {
  //杜绝又有全勾选又有中间态的情况
  if (newSelected === true && indeterminate.value === true) {
    indeterminate.value = false
  }
})
/****************以上是监听全选选中状态****************/

/****************以下是监听列表项选中状态****************/
const childrenShowTreeData: ComputedRef<TreeData[]> = computed(() => {
  return !isEmpty(treeDataList.value) ? treeDataList.value!.filter(item => item.isShow) : []
})

async function childrenCheckedChanged(event: Event): Promise<void> {
  await nextTick()
  if (isEmpty(treeDataList.value)) return
  const selectedLst: boolean[] = []
  const indeterminateLst: boolean[] = []
  treeDataList.value.forEach(item => {
    selectedLst.push(item.selected)
    indeterminateLst.push(item.indeterminate)
  })

  if (indeterminateLst.some(item => item)) {
    indeterminate.value = true
    selected.value = false
  } else {
    let hasTrue: boolean = false
    let hasFalse: boolean = false
    for (let item of selectedLst) {
      if (item) {
        hasTrue = true
      } else {
        hasFalse = true
      }

      if (hasTrue && hasFalse) {
        break
      }
    }

    if (hasTrue && hasFalse) {
      indeterminate.value = true
      selected.value = false
    } else if (hasTrue) {
      indeterminate.value = false
      selected.value = true
    } else {
      indeterminate.value = false
      selected.value = false
    }
  }

  event.stopPropagation()
}
/****************以上是监听列表项选中状态****************/

/****************以下是监听重置事件****************/
//外部传重置状态位
const isReset: ModelRef<boolean> = defineModel('isReset', { required: true, default: false })
provide('isReset', isReset)

watch(isReset, newVal => {
  if (newVal === true) {
    selected.value = false
    indeterminate.value = false
    refreshHignLight()
  }
})
/****************以上是监听重置事件****************/

/****************以下是捕获子组件树中的异常****************/
interface MsgRefType {
  open: (obj: { message: string; type?: string; position?: string; duration?: number }) => void
}
const msgRef: Ref<MsgRefType | undefined> = ref()
onErrorCaptured((err: unknown, instance: ComponentPublicInstance | null) => {
  let errMsg: string = ''
  let target: string = ''
  if (err instanceof Error) {
    errMsg = err.message
  } else if (typeof err === 'string') {
    errMsg = err
  } else {
    errMsg = JSON.stringify(err)
  }

  if (!isEmpty(instance?.$options?.name)) {
    target = instance!.$options!.name!
  } else {
    target = 'something'
  }
  logUtils.e(`${target} happened error...`, errMsg)
  msgRef.value?.['open']?.({
    message: errMsg,
    type: 'text',
    position: 'bottom',
    duration: 1500
  })

  // 停止错误继续向上传播
  return false
})
/****************以上是捕获子组件树中的异常****************/
</script>

<style lang="scss" scoped>
* {
  box-sizing: border-box;
}

.searchBar {
  position: sticky;
  top: 0px;
  background-color: white;
  z-index: 1;
  :deep(.mx-icon) {
    &::before {
      font-size: 16px;
    }
  }
}

$base-padding-left: 38px;
.total_controllBar {
  height: 48px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  padding-left: $base-padding-left;

  > :deep(.mx-checkbox-item) {
    min-height: 48px;
    display: flex;
    align-items: center;
    height: 48px;
    margin: 0px;

    $not-all-color: #3986ff !important;
    .mx-checkbox-item--icon-xui-not-all {
      background-color: $not-all-color;
      border-color: $not-all-color;
    }

    .mx-checkbox-item__icon {
      margin: 0px;
      padding: 0px;
      display: flex;
      justify-content: center;
      align-items: center;

      $not-all-color: #3986ff !important;
      > .mx-checkbox-item--icon {
        min-width: 20px;
        min-height: 20px;

        &.mx-checkbox-item--icon-xui-all {
          &::after {
            left: 7px;
            top: 3px;
            transform: rotate(45deg) scale(1.2);
          }
        }

        &.mx-checkbox-item--icon-xui-not-all {
          background-color: $not-all-color;
          border-color: $not-all-color;

          &::after {
            top: 3px;
            left: 6px;
          }
        }
      }
    }

    .mx-checkbox-item__label {
      margin-left: 14px;
    }
  }
}

.fade-enter-active,
.fade-leave-active {
  will-change: opacity;
  transition-property: opacity;
  transition-duration: 0.3s;
  transition-timing-function: ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.fade-enter-to,
.fade-leave-from {
  opacity: 1;
  height: auto;
}

.body {
  overflow: auto;

  @supports (interpolate-size: allow-keywords) {
    interpolate-size: allow-keywords;
    transition-property: height, padding-bottom, opacity;

    &.fade-enter-active,
    &.fade-leave-active {
      will-change: height, padding-bottom, opacity;
    }
    &.fade-enter-from,
    &.fade-leave-to {
      height: 0px;
      padding-bottom: 0px;
      opacity: 0;
    }
    &.fade-enter-to,
    &.fade-leave-from {
      opacity: 1;
      height: fit-content;
    }
  }
}

:deep(.mx-search-bar__container) {
  margin-left: 0px;
  margin-right: 0px;
}
</style>
