<template>
  <Transition
    name="fade"
    mode="out-in">
    <div
      v-show="treeData.isShow"
      ref="checkTree"
      class="checkTree">
      <div
        class="checkBox_container"
        @click.stop="toggleCollpase">
        <mx-icon
          v-if="treeData.nodeType !== NodeTypeEnum.LEAF && !isEmpty(childrenShowTreeData) && level < maxLevel"
          :class="{ expand: !treeData.isCollapsed }"
          icon="arrow_down_filled"></mx-icon>

        <el-checkbox
          :indeterminate="treeData.indeterminate"
          :model-value="treeData.selected"
          @update:model-value="checkedChanged">
          <span
            :ref="
              el => {
                if (!isNil(el)) {
                  treeData.nameDom = el as HTMLElement
                }
              }
            ">
            {{ treeData.name }}
          </span>
          <span
            v-if="!isHideLabel"
            :ref="
              el => {
                if (!isNil(el)) {
                  treeData.labelDom = el as HTMLElement
                }
              }
            ">
            {{ treeData.label }}
          </span>
        </el-checkbox>
      </div>

      <Transition
        name="fade"
        mode="out-in">
        <template v-if="treeData.childrenTreeData && level < maxLevel">
          <div
            v-show="!treeData.isCollapsed"
            class="childrenTree"
            @change="childrenCheckedChanged"
            @matchHit="matchHit">
            <template
              v-for="(item, index) in treeData.childrenTreeData"
              :key="childrenLevel + item.name">
              <CheckTree
                v-model:treeData="treeData.childrenTreeData[index]"
                :parentChecked="treeData.selected"
                :parentIndeterminate="treeData.indeterminate"
                :level="childrenLevel"
                :keyword="keyword"></CheckTree>
            </template>
          </div>
        </template>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import {
  type ComputedRef,
  computed,
  type ModelRef,
  type Ref,
  ref,
  watch,
  inject,
  readonly,
  nextTick,
  onBeforeUnmount
} from 'vue'
import { isNil, isEmpty } from 'lodash'
import { type TreeData, NodeTypeEnum, CanNotSearchEnum } from '../types'
import { escapeRegExp } from 'lodash'

const props = defineProps({
  parentChecked: { type: Boolean, required: true },
  parentIndeterminate: { type: Boolean, required: true },
  level: { type: Number, required: false, default: 1 }
})

//控制最大层数
const maxLevel: number = inject('maxLevel', Number.MAX_SAFE_INTEGER)
const canNotSearch: CanNotSearchEnum | undefined = inject('canNotSearch')
const treeData: ModelRef<TreeData> = defineModel('treeData', { required: true })
const isHideLabel: boolean = inject('isHideLabel', false)

/****************以下是监听父级选中状态****************/
watch(
  () => props.parentChecked,
  () => {
    if (!isNil(props.parentChecked) && props.parentChecked === true) {
      treeData.value.selected = true
    } else if (!isNil(props.parentIndeterminate) && props.parentIndeterminate === false) {
      treeData.value.selected = false
    }
  }
)

const paddingLeft: ComputedRef<string> = computed(
  () => (props.level - 1) * 30 + (treeData.value.nodeType === NodeTypeEnum.LEAF ? 30 : 0) + 'px'
)
/****************以上是监听父级选中状态****************/

/****************以下是监听本级选中状态****************/
const checkTree: Ref<HTMLElement | undefined> = ref()

watch(
  () => treeData.value.selected,
  newSelected => {
    //杜绝又有全勾选又有中间态的情况
    if (newSelected === true && treeData.value.indeterminate === true) {
      treeData.value.indeterminate = false
    }
  }
)

function checkedChanged(selected: boolean): void {
  treeData.value.selected = selected

  //向父级节点发送变化属性
  checkTree.value?.dispatchEvent(new CustomEvent('change', { bubbles: true, cancelable: true }))
}
/****************以上是监听本级选中状态****************/

/****************以下是监听子级选中状态****************/
const childrenLevel: ComputedRef<number> = computed(() => {
  //子节点深度为本节点深度+1
  return props.level + 1
})

const childrenShowTreeData: ComputedRef<TreeData[]> = computed(() => {
  return !isEmpty(treeData.value.childrenTreeData) ? treeData.value.childrenTreeData!.filter(item => item.isShow) : []
})

async function childrenCheckedChanged(): Promise<void> {
  await nextTick()
  if (isEmpty(treeData.value.childrenTreeData)) return
  const selectedLst: boolean[] = []
  const indeterminateLst: boolean[] = []
  treeData.value.childrenTreeData!.forEach(item => {
    selectedLst.push(item.selected)
    indeterminateLst.push(item.indeterminate)
  })

  if (indeterminateLst.some(item => item)) {
    treeData.value.indeterminate = true
    treeData.value.selected = false
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
      treeData.value.indeterminate = true
      treeData.value.selected = false
    } else if (hasTrue) {
      treeData.value.indeterminate = false
      treeData.value.selected = true
    } else {
      treeData.value.indeterminate = false
      treeData.value.selected = false
    }
  }
}
/****************以上是监听子级选中状态****************/

/****************以下是关键词搜索****************/
const keyword: Ref<string> = readonly(inject('keyword', ref('')))
const hightRangeArr: Ref<Range[]> = inject('hightRangeArr', ref([]))

//匹配命中冒泡事件
function matchHit(): void {
  treeData.value.isCollapsed = false
  treeData.value.isShow = true
}

const matchHitTrigger: (markText: string) => void = async (markText: string) => {
  // 查询匹配字符
  const reg = new RegExp(escapeRegExp(markText), 'gi')

  if (!isEmpty(markText) && canNotSearch !== CanNotSearchEnum.BOTH) {
    //判断搜索框关键词是否存在

    //匹配名字
    let nameIndexArr: number[] | undefined
    if (canNotSearch !== CanNotSearchEnum.NAME) {
      nameIndexArr = [...treeData.value.name.matchAll(reg)].map(item => item.index)
    }

    //匹配标签
    let labelIndexArr: number[] | undefined
    const checkLabel: boolean = !isHideLabel && canNotSearch !== CanNotSearchEnum.LABEL && !isNil(treeData.value.label)
    if (checkLabel) {
      labelIndexArr = [...treeData.value.label!.matchAll(reg)].map(item => item.index)
    }

    treeData.value.isCollapsed = false
    //关键词是否匹配中本节点名字
    if (
      (!isEmpty(nameIndexArr) && !isNil(treeData.value.nameDom?.firstChild)) ||
      (!isEmpty(labelIndexArr) && !isNil(treeData.value.labelDom?.firstChild))
    ) {
      treeData.value.isShow = true

      //添加名字到高亮列表
      const rangeNameArr: Range[] = nameIndexArr!.map(start => {
        const range = new Range()
        range.setStart(treeData.value.nameDom!.firstChild!, start)
        range.setEnd(treeData.value.nameDom!.firstChild!, start + markText.length)
        return range
      })
      hightRangeArr.value.push(...rangeNameArr.flat())
      if (treeData.value.nodeType !== NodeTypeEnum.ROOT) {
        checkTree.value?.dispatchEvent(new CustomEvent('matchHit', { bubbles: true, cancelable: true }))
      }

      if (!checkLabel) {
        return
      }
      //添加标签到高亮列表
      const rangeLabelArr: Range[] = labelIndexArr!.map(start => {
        const range = new Range()
        range.setStart(treeData.value.labelDom!.firstChild!, start)
        range.setEnd(treeData.value.labelDom!.firstChild!, start + markText.length)
        return range
      })
      hightRangeArr.value.push(...rangeLabelArr.flat())
      if (treeData.value.nodeType !== NodeTypeEnum.ROOT) {
        checkTree.value?.dispatchEvent(new CustomEvent('matchHit', { bubbles: true, cancelable: true }))
      }
    } else {
      treeData.value.isShow = false
    }
  } else {
    treeData.value.isShow = true
  }
}

watch(keyword, matchHitTrigger)

const clearSearchFlag: Ref<boolean> = readonly(inject('clearSearchFlag', ref(false)))
watch(clearSearchFlag, newVal => {
  if (newVal === true) {
    treeData.value.isShow = true
  }
})

//组件卸载时去除dom的引用
onBeforeUnmount(() => {
  treeData.value.nameDom = undefined
  treeData.value.labelDom = undefined
})
/****************以上是关键词搜索****************/

/****************以下是子列表展开****************/
function toggleCollpase(event: Event): void {
  let tokenList: DOMTokenList = (event.target as HTMLElement).classList

  if (
    !isEmpty(childrenShowTreeData.value) &&
    (tokenList.contains('checkBox_container') || tokenList.contains('mx-icon'))
  ) {
    treeData.value.isCollapsed = !treeData.value.isCollapsed
  }
}
/****************以上是子列表展开****************/

/**********以下是监听重置事件***********/
//重置状态位
const isReset: Ref<boolean> = readonly(inject('isReset', ref(false)))

watch(isReset, newVal => {
  if (newVal === true) {
    treeData.value.indeterminate = false
    treeData.value.isCollapsed = false
    treeData.value.isShow = true
    treeData.value.selected = false
  }
})
/**********以上是监听重置事件***********/
</script>

<style lang="scss" scoped>
.checkTree {
  z-index: 0;

  * {
    margin: 0px;
    padding: 0px;
    box-sizing: border-box;
  }

  transition-property: opacity;
  transition-duration: 0.3s;
  transition-timing-function: ease;

  .fade-enter-active,
  .fade-leave-active {
    will-change: opacity;
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

  $arrow-width: 12px;
  $base-padding-left: 8px;
  $level-padding-left: v-bind(paddingLeft);

  > .checkBox_container {
    display: flex;
    padding-left: calc(#{$base-padding-left} + #{$level-padding-left});
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);

    $marginRight: 18px;
    > :deep(.mx-icon) {
      width: $arrow-width;
      transition-property: transform;
      transition-duration: 0.3s;
      transition-timing-function: ease;
      margin-right: $marginRight;

      &.expand {
        transform: rotate(-180deg);
      }

      * {
        pointer-events: none;
      }
    }
  }

  :deep(.mx-checkbox-item) {
    min-height: 18px;
    height: fit-content;

    $not-all-color: #3986ff !important;
    .mx-checkbox-item--icon-xui-not-all {
      background-color: $not-all-color;
      border-color: $not-all-color;
    }

    .mx-checkbox-item__icon {
      display: flex;
      justify-content: center;
      align-items: center;
      $not-all-color: #3986ff !important;
      margin-right: 14px;

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
  }

  > .childrenTree {
    transition-property: opacity;
    transition-duration: 0.3s;
    transition-timing-function: ease;
    overflow: hidden;

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

  :deep(.checkboxName) {
    span {
      interpolate-size: allow-keywords;
      transition: background-color 0.3s ease;
      background-color: yellow;
      @starting-style {
        background-color: transparent;
      }
    }
  }
}
::highlight(text-highlight) {
  background-color: yellow;
}
</style>
