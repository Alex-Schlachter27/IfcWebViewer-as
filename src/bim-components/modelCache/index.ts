import * as OBC from "@thatopen/components";
import * as FRAGS from "@thatopen/fragments";
import { buildingElement } from "../../utilities/BuildingElementUtilities";
import { GetBuildingElements } from "../../utilities/IfcUtilities";
import { ModelViewManager } from "../modelViewer";

export class ModelCache extends OBC.Component {
    private _enabled = false
    private _models: Map<string, FRAGS.FragmentsGroup> = new Map<string, FRAGS.FragmentsGroup>;
    static uuid = "005d1863-99d7-453d-96ef-c07b309758ce" as const;
    readonly onModelAdded = new OBC.Event<FRAGS.FragmentsGroup>()
    readonly onModelStartRemoving = new OBC.Event<FRAGS.FragmentsGroup>()
    readonly onBuildingElementsChanged = new OBC.Event<buildingElement[]>()
    private _world: OBC.World | null = null;

    private _buildingElements: buildingElement[] | undefined;

    constructor(components: OBC.Components) {
        super(components);
    }


    delete(model: string) {
        this._models.delete(model)
    }

    async add(model: FRAGS.FragmentsGroup): Promise<boolean> {
        if (this._models.has(model.uuid))
            return false;

        this._models.set(model.uuid, model)
        console.log("model added to cache", model)
        this.onModelAdded.trigger(model)

        try {
            let newElements = await GetBuildingElements(model, this.components);
            if (!this._buildingElements) {
                this._buildingElements = newElements;
            }
            else {
                this._buildingElements = this._buildingElements.concat(newElements);
            }

            // console.log('ModelCache: building elements changed', this._buildingElements)
            this.onBuildingElementsChanged.trigger(this._buildingElements);

            this.components.get(ModelViewManager).setUpGroups(this._buildingElements);
            this.components.get(ModelViewManager).enabled = true;
            return true;
        } catch (error) {
            console.error('Error fetching building elements:', error);
            return false;
        }

    }

    exists(model: FRAGS.FragmentsGroup): boolean {
        return this._models.has(model.uuid);
    }

    dispose() {
        this._models = new Map<string, FRAGS.FragmentsGroup>();
        this._buildingElements = [];
    }

    set world(world: OBC.World | null) {
        this._world = world
        console.log("model cache, new world set", world)

        if (world) {
        }
    }

    get world() {
        return this._world
    }


    set enabled(value: boolean) {
        this._enabled = value;
    }

    get enabled() {
        return this._enabled
    }

    get BuildingElements() {
        return this._buildingElements;
    }
}