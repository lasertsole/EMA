import { NodeType, SELECTED } from "../enums";

export interface TreeData {
  name: string;
  keywordName?: string;
  label?: string;
  isCollpase: boolean;
  nodeType: NodeType;
  selected: boolean;
  indeterminate: boolean;
  childrenTreeData?: TreeData[];
}