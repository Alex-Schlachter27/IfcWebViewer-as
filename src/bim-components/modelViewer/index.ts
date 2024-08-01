import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as FRAGS from "@thatopen/fragments";
import * as THREE from 'three'
import { FragmentsGroup } from "@thatopen/fragments";
import { setUpGroup, setUpTree } from "../../utilities/BuildingElementUtilities";
import { GetFragmentsFromExpressIds } from "../../utilities/IfcUtilities";
import { buildingElement, SelectionGroup, VisibilityMode, VisibilityState } from "../../utilities/types";
import { Tree, TreeNode, TreeUtils } from "../../utilities/Tree";
import { _roots } from "@react-three/fiber";



export class ModelViewManager extends OBC.Component {
    private _enabled = false;
    private _isSetup = false;
    static uuid = "0f5e514e-5c1c-4097-a9cc-6620c2e28378" as const;
    private _groups?: Map<string, Map<string, buildingElement[]>>;
    private _tree?: Tree<buildingElement>;
    readonly onGroupsChanged = new OBC.Event<Map<string, Map<string, buildingElement[]>> | undefined>();
    readonly onTreeChanged = new OBC.Event<Tree<buildingElement> | undefined>();
    readonly onBuildingElementsChanged = new OBC.Event<buildingElement[]>();
    readonly onGroupVisibilitySet = new OBC.Event<Map<string, VisibilityState>>();
    readonly onSelectedGroupChanged = new OBC.Event<SelectionGroup>();
    readonly onVisibilityModeChanged = new OBC.Event<VisibilityMode>();
    private _groupVisibility?: Map<string, VisibilityState>;
    private _treeVisibility?: Map<string, VisibilityState>;
    private _selectedGroup?: SelectionGroup;

    get SelectedGroup(): SelectionGroup | undefined {
        return this._selectedGroup;
    }
    set SelectedGroup(selectionGroup: SelectionGroup | undefined) {
        if (!selectionGroup) return;
        this._selectedGroup = selectionGroup;
        console.log("ModelViewManager: selected group changed:", selectionGroup)
        this.onSelectedGroupChanged.trigger(this._selectedGroup)

        // Add any additional logic needed when setting the selection group
    }

    get Tree(): Tree<buildingElement> | undefined {
        return this._tree;
    }

    constructor(components: OBC.Components) {
        super(components);

        const frag = components.get(OBC.FragmentsManager)
        frag.onFragmentsDisposed.add((data) => this.cleanUp(data.groupID, data.fragmentIDs))
    }

    cleanUp = (groupID: string, fragmentIDs: string[]) => {



    }

    getBuildingElements = (groupId: string) : buildingElement[] | undefined => {
        if(!groupId || !this._tree) return;

        const groupNode = this._tree.getNode(groupId);

        if(!groupNode) return;

        return TreeUtils.getChildrenNonNullData(groupNode)
    }

    setUpGroups = (buildingElements: buildingElement[] | undefined, groupVisibility?: Map<string, VisibilityState>): void => {
        if (!buildingElements) {
            this._groups = undefined;
            this.onGroupsChanged.trigger(undefined);
            return;
        }

        //this._groups = setUpGroup(buildingElements);
        this._tree = setUpTree(buildingElements);
        console.log("tree created:", this._tree)
        console.log("modelViewManager: groups set:", this._groups);
        this.onGroupsChanged.trigger(this._groups);
        this.onTreeChanged.trigger(this._tree);

        //this._groupVisibility = groupVisibility ?? this.createDefaultGroupVisibility();
        this._treeVisibility = this.createDefaultTreeVisibility();
        console.log("tree vis:", this._treeVisibility)
        this._selectedGroup = undefined;
        this._enabled = true;
        this.onGroupVisibilitySet.trigger(this._treeVisibility);
        this.updateVisibility();
    }

    private createDefaultGroupVisibility(): Map<string, VisibilityState> {
        if (!this._groups) throw new Error("Groups not initialized");
        const keys = Array.from(this._groups.values()).flatMap(a => Array.from(a.keys()));
        return new Map(keys.map(name => [name, VisibilityState.Visible]));
    }

    private createDefaultTreeVisibility(): Map<string, VisibilityState> {
        if (!this._tree) throw new Error("Tree not initialized");
        const keys = Array.from(this._tree.getFlatTreeNodes()).filter(element => element.type !== "BuildingElement").flatMap(a => a.id);
        console.log("tree vis:", this._treeVisibility)
        return new Map(keys.map(name => [name, VisibilityState.Visible]));
    }

    
    get GroupVisibility(): Map<string, VisibilityState> | undefined {
        return this._treeVisibility;
    }

    get Groups(): Map<string, Map<string, buildingElement[]>> | undefined {
        return this._groups;
    }

    get enabled(): boolean {
        return this._enabled;
    }

    private _visibilityMode: VisibilityMode = VisibilityMode.Isolate;

    get VisibilityMode(): VisibilityMode {
        return this._visibilityMode;
    }

    // visibilityMode determines how selected and non selected groupings will be displayed.
    set VisibilityMode(value: VisibilityMode) {
        console.log("Visibility mode set:", value)
        this._visibilityMode = value;
        this.onVisibilityModeChanged.trigger(this._visibilityMode);
    }

    // Group Visibility : key = group Name, value = visibility state. will be used to determine the visibility of geometry 
    // when triggering updateVisibility;
    set GroupVisibility(value: Map<string, VisibilityState> | undefined) {
        console.log("ModelViewManager: group vis being set", value);
        this._treeVisibility = value;
        this.onGroupVisibilitySet.trigger(this._treeVisibility);
        this.updateVisibility();
    }

    isolate(group: SelectionGroup) {
        if(!group.id) return;

        const node = this._tree?.getNode(group.id);
        const sameNodeTypes = this._tree?.getNodes(n => n.type === node?.type)
        if(!sameNodeTypes) return;

        sameNodeTypes.forEach(element => {
            this.setVisibility(element.id,element.id === group.id ? VisibilityState.Visible : VisibilityState.Hidden,false)
        });

        this.updateVisibility();
    }

    // sets new value if key if found matching groupname. if update is true then 3d scene will update visibility based on change
    setVisibility(id: string, state: VisibilityState, updateVisibility: boolean = false) {

        if (!this._treeVisibility || !id || !this._treeVisibility?.has(id)) {
            console.log("failed to change visibility,name not found:", id, this._treeVisibility?.keys())
            return;
        }
        if (this._treeVisibility.get(id) === state) {
            console.log("failed to change visibility, state already the same:", this._treeVisibility.get(id))
            return;
        }

        this._treeVisibility.set(id, state);

        if (updateVisibility) this.updateVisibility();
    }


    private SetVisibility(fragments: OBC.FragmentsManager, elements: buildingElement[] | undefined, visibility: VisibilityState): void {

        if (!elements) return;
        const elementsByModelId = this.groupElementsByModelId(elements);

        fragments.groups.forEach(model => {
            const elementsForModel = elementsByModelId.get(model.uuid);
            if (elementsForModel) {
                const allFragments = GetFragmentsFromExpressIds(elementsForModel.map(element => element.expressID), fragments, model);
                console.log("Setting visibility", visibility)
                allFragments.forEach((ids, frag) => frag.setVisibility(visibility !== VisibilityState.Hidden, ids));
            }
        });
    }

    // if color = true color will be reset to original
    private SetColor(fragments: OBC.FragmentsManager, elements: buildingElement[], color: boolean | THREE.Color = false): void {
        const elementsByModelId = this.groupElementsByModelId(elements);

        fragments.groups.forEach(model => {
            const elementsForModel = elementsByModelId.get(model.uuid);
            if (elementsForModel) {
                const allFragments = GetFragmentsFromExpressIds(elementsForModel.map(element => element.expressID), fragments, model);
                if (color === true)
                    allFragments.forEach((ids, frag) => frag.resetColor(ids));
                else if (color instanceof THREE.Color)
                    allFragments.forEach((ids, frag) => frag.setColor(color, ids));
            }
        });
    }

    private groupElementsByModelId(elements: buildingElement[]): Map<string, buildingElement[]> {
        return elements.reduce((acc, element) => {
            if (!acc.has(element.modelID)) {
                acc.set(element.modelID, []);
            }
            acc.get(element.modelID)!.push(element);
            return acc;
        }, new Map<string, buildingElement[]>());
    }

    private updateVisibility = () => {
        console.log("update Visibility", this._treeVisibility)

        if (!this._enabled || !this.components || !this._tree) return;

        const fragments = this.components.get(OBC.FragmentsManager);
        if (!this._treeVisibility) {
            const allElements = this.getAllElements();
            this.SetVisibility(fragments, allElements, VisibilityState.Visible);
            console.log("hide elements fails, showing all instead")

            return;
        }

        const test = this.groupElementsByVisibilityState();
        console.log("tree vis state groups:", test)
        if (test) {
            this.SetVisibility(fragments, test.get(VisibilityState.Visible), VisibilityState.Visible);
            this.SetVisibility(fragments, test.get(VisibilityState.Hidden), VisibilityState.Hidden);
        }
        else {
            const { visibleElements, hiddenElements } = this.categorizeElements();
            const cleanVisibleElements = this.filterVisibleElements(visibleElements, hiddenElements);
            this.SetVisibility(fragments, cleanVisibleElements, VisibilityState.Visible);
            this.SetVisibility(fragments, hiddenElements, VisibilityState.Hidden);
            console.log("update Visibility: hide", hiddenElements)
            console.log("update Visibility: show", cleanVisibleElements)
        }

    };

    private getAllElements(): buildingElement[] {
        return Array.from(this._groups!.values())
            .flatMap(innerMap => Array.from(innerMap.values()))
            .flat();
    }

    // groups elements into visible and non visible
    private categorizeElements(): { visibleElements: buildingElement[], hiddenElements: buildingElement[] } {
        let visibleElements: buildingElement[] = [];
        let hiddenElements: buildingElement[] = [];

        // const stations = this._groups!.get('Station');
        // if (stations) {
        //     for (let [key, value] of stations.entries()) {
        //         if (this._groupVisibility!.get(key)) {
        //             visibleElements = visibleElements.concat(value);
        //         } else {
        //             hiddenElements = hiddenElements.concat(value);
        //         }
        //     }
        // }

        // const otherGroups = new Map(this._groups);
        // otherGroups.delete('Station');
        // for (let [, group] of otherGroups) {
        //     for (let [groupName, elements] of group) {
        //         if (this._groupVisibility!.get(groupName)) {
        //             visibleElements = visibleElements.concat(elements);
        //         } else {
        //             hiddenElements = hiddenElements.concat(elements);
        //         }
        //     }
        // }

        return { visibleElements, hiddenElements };
    }

    // search element tree and group building elements by visibility state of their highest parent node 
    private groupElementsByVisibilityState(): Map<VisibilityState, buildingElement[]> | undefined {

        // depending on visibility mode
        if (!this._tree || !this._treeVisibility) return undefined;

        //go through the treenodes searching deeply
        // for each node search the _treeVisibilityMap to see if the node can be found by id, then if the id is found check its visibility state
        // depending on the visibility state (hidden, vissible, ghost) you will add children too a different visibility entry in the returning map

        // 1. if the parent node is hidden, all children nodes will be hidden
        // 2. if parent node is ghost, children node of type visible and ghost will be ghost, and hidden remains hidden
        // 3. if parent node is visble nothing changes 

        const result = new Map<VisibilityState, buildingElement[]>();
        result.set(VisibilityState.Visible, []);
        result.set(VisibilityState.Hidden, []);
        result.set(VisibilityState.Ghost, []);


        const traverseNode = (node: TreeNode<buildingElement>, parentState: VisibilityState) => {

            if (!this._tree || !this._treeVisibility) return undefined;

            const nodeVisibility = this._treeVisibility.get(node.id) || parentState;

            if (node.isLeaf) {
                // This is a building element node
                switch (nodeVisibility) {
                    case VisibilityState.Hidden:
                        result.get(VisibilityState.Hidden)!.push(node.data!);
                        break;
                    case VisibilityState.Ghost:
                        result.get(VisibilityState.Ghost)!.push(node.data!);
                        break;
                    case VisibilityState.Visible:
                        result.get(VisibilityState.Visible)!.push(node.data!);
                        break;
                }
            } else {
                // This is a container node, traverse its children
                node.children.forEach(child => {
                    let childState = nodeVisibility;
                    if (nodeVisibility === VisibilityState.Ghost &&
                        this._treeVisibility?.get(child.id) === VisibilityState.Visible) {
                        childState = VisibilityState.Ghost;
                    }
                    traverseNode(child, childState);
                });
            }
        };

        // Start traversal from the root
        traverseNode(this._tree.root!, VisibilityState.Visible);
        // console.log("vis state grouped",result)
        return result;
    }

    private filterVisibleElements(visibleElements: buildingElement[], hiddenElements: buildingElement[]): buildingElement[] {
        const hiddenElementIds = new Set(hiddenElements.map(element => element.expressID));
        return visibleElements.filter(element => !hiddenElementIds.has(element.expressID));
    }
}