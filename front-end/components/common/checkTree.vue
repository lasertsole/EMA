<template>
<div class="checkTree" ref="checkTree">
    <div  v-if="treeData.nodeType==NodeType.ROOT">
        <div >
            <el-input
                v-model="keyword"
                style="width: 100%"
                placeholder="Please input"
                clearable
            />
        </div>
        <div><ElCheckbox v-model="treeData.selected">全选</ElCheckbox></div>
    </div>

    <ElCheckbox
        :indeterminate="treeData.indeterminate"
        v-model="treeData.selected"
    >
        <span class="checkboxName" v-html="treeData.keywordName || treeData.name"></span>
    </ElCheckbox>

    <div class="childrenTree" v-if="treeData.childrenTreeData" v-show="!treeData.isCollpase" @change="childrenCheckedChanged"  @expand="expand">
        <template v-for="(item, index) in treeData.childrenTreeData" :key="index">
            <CommonCheckTree
                :parentChecked="treeData.selected"
                :parentIndeterminate="treeData.indeterminate"
                v-model:treeData="treeData.childrenTreeData[index]"
            ></CommonCheckTree>
        </template>
    </div>
</div>
</template>

<script setup lang="ts">
import {type Reactive, type ModelRef } from "vue";
import type { TreeData } from './types';
import { NodeType } from './enums';
import { isNil, debounce } from "lodash-es";

const props = defineProps({
    parentChecked: {type:Boolean, required: false },
    parentIndeterminate: {type:Boolean, required: false },
});
const treeDataModelRef:ModelRef<Reactive<TreeData>> = defineModel('treeData',{required: true});
const treeData:Reactive<TreeData> = treeDataModelRef.value;

const paddingLeft:Ref<string> = ref(treeData.nodeType==NodeType.ROOT?"0px":"20px");

// 监听父级选中状态
watch(()=>props.parentChecked,(newVal:boolean)=>{
    if(!isNil(props.parentChecked)&&props.parentChecked==true){
        treeData.selected = true;
    } else if(!isNil(props.parentIndeterminate)&&props.parentIndeterminate==false){
        treeData.selected = false;
    }
});

// 监听子级选中状态
function childrenCheckedChanged():void{
    const selectedLst:boolean[] = treeData.childrenTreeData!.map(item=>item.selected);
    const indeterminateLst:boolean[] = treeData.childrenTreeData!.map(item=>item.indeterminate);

    if(indeterminateLst.some(item=>item)){
        treeData.indeterminate = true;
        treeData.selected = false;
        return;
    }
    
    let hasTrue:boolean =false;
    let hasFalse:boolean =false;
    for(let item of selectedLst){
        if(item){
            hasTrue = true;
        } else {
            hasFalse = true;
        }

        if(hasTrue&&hasFalse){
            break;
        }
    }

    if(hasTrue&&hasFalse){
        treeData.indeterminate = true;
        treeData.selected = false;
    } else if(hasTrue){
        treeData.indeterminate = false;
        treeData.selected = true;
    } else {
        treeData.indeterminate = false;
        treeData.selected = false;
    }
}

let keyword:Ref<string>;
switch(treeData.nodeType){
    case NodeType.ROOT:
        keyword = ref("");
        provide('keyword', keyword);
        break;
    default:
        keyword = inject('keyword')!;
}

const checkTree:Ref<HTMLElement|undefined> = ref();
onMounted(()=>{
    if(isNil(checkTree.value)){
        return;
    }

    watch(keyword,debounce((markText:string)=>{
        const reg = new RegExp(markText, "g");
        const hasExecResult:boolean = !isNil(reg.exec(treeData.name));
        console.log();
        if(!isEmpty(markText)&&hasExecResult){
            const result:string = treeData.name.replace(reg, `<span>${markText}</span>`);
            treeData.keywordName = result;
            treeData.isCollpase = false;
            checkTree.value!.dispatchEvent(new CustomEvent("expand",{bubbles: true, cancelable: true}));
        } else{
            treeData.keywordName = "";
        }
    },500)) ;
})

function expand(event:CustomEvent){
    treeData.isCollpase = false;
    if(NodeType.ROOT==treeData.nodeType){
        event.stopPropagation();
    }
}

</script>

<style lang="scss" scoped>
    @use "sass:math";
    @use "@/common.scss" as common;

    .checkTree{
        $paddingLeft: v-bind(paddingLeft);
        padding-left: $paddingLeft;

        :deep(.checkboxName){
            span{
                background-color: yellow;
            }
        }
    }
</style>