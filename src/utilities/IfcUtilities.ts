
import * as OBC from "@thatopen/components";
import * as FRAGS from "@thatopen/fragments";
import * as WEBIFC from "web-ifc";


export interface buildingElement {
    expressID: number;
    GlobalID: string;
    type: number;
    name: string;
    properties: {name: string, value: string}[]
}



export function getStationBarChartArray(elements: buildingElement[]) : any[]
{
    // group by station
    
    const groupedByStation: Record<string, Record<string, buildingElement[]>> = {};


    elements.forEach(element => {
        const stationFilter = element.properties.find(prop => prop.name === "Station")
        const productCodeFilter = element.properties.find(prop => prop.name === "Productcode")

        if(stationFilter && productCodeFilter)
        {
            const station = stationFilter.value;
            const productCode = productCodeFilter.value;

            var codeCategory: string = "";// = "Other"
            if(productCode.includes('UN')){
                codeCategory = "UN"
            } 
            else if (productCode.includes("EP")){
                codeCategory = "EP"
            } 
            else if (productCode.includes("CE")) {
                codeCategory = "CE"
            }


            if(!groupedByStation[station]) {
                groupedByStation[station] = {}
            }

            if(!groupedByStation[station][codeCategory]) {
                groupedByStation[station][codeCategory] = [];
            }

            groupedByStation[station][codeCategory].push(element)
        }
    })

    //console.log("grouped by station and code ",groupedByStation);


    return convertToStationArray(groupedByStation);

}
interface StationObj {
    station: string;
    CE: 0;
    UN: 0;
    EP: 0;
    Other: 0;
    [key: string]: string | Number;
};

function convertToStationArray(groupedByStation: Record<string, Record<string, buildingElement[]>>) : any[] {
    const stationSummary: any[] = [];

    for (const station in groupedByStation)
    {
        if(groupedByStation.hasOwnProperty(station)) {
            const stationObj: StationObj = {
                station: station,
                CE: 0,
                UN: 0,
                EP: 0,
                Other: 0,
                };

            for(const category in groupedByStation[station]) {
                if(groupedByStation[station].hasOwnProperty(category)) {
                    stationObj[category] = groupedByStation[station][category].length
                }
            }
            stationSummary.push(stationObj);

        }
    }
    console.log("grouped by station and code ",stationSummary);
    return stationSummary;

}


  
export function getEPElementCount(elements: buildingElement[])
{
    return elements.filter(element => element.properties.some(property => property.value.includes("EP-"))).length;
}


export function getUniqueElementCount(elements: buildingElement[])
{
    const groupedByProductCode: Record<string, buildingElement[]> = {};


    elements.forEach(element => {
        const codeFilter = element.properties.find(prop => prop.name ==="Productcode")
        if(codeFilter)
        {
            const productCode = codeFilter.value;
            if(!groupedByProductCode[productCode]) {
                groupedByProductCode[productCode] = []
            }
            groupedByProductCode[productCode].push(element)

        }
    })
    return Object.keys(groupedByProductCode).length;
}

export async function GetBuildingElements(loadedModel : FRAGS.FragmentsGroup, components : OBC.Components)
{
    if(!components)
    {
        console.log('compoenets not set, getBuildingELements exiting')
        return [];
    }
    // this process attempting example https://github.com/ThatOpen/engine_components/blob/318f4dd9ebecb95e50759eb41f290df57c008fb3/packages/core/src/ifc/IfcRelationsIndexer/index.ts#L235
    // const propsProcessor = components.get(OBC.FragmentsManager);
    // const indexer = components.get(OBC.IfcRelationsIndexer);
    // await indexer.process(loadedModel);
    // console.log("indexer",indexer)

    const foundElements: buildingElement[] = [];
    const elements = loadedModel.getLocalProperties();
    await OBC.IfcPropertiesUtils.getRelationMap(loadedModel,WEBIFC.IFCRELDEFINESBYPROPERTIES,(async (propertySetID, _relatedElementsIDs) => { 

        _relatedElementsIDs.forEach(reltingElement => {
            if(elements)
            {
                const element = elements[reltingElement]
                console.log("element related",element)

                const newElement : buildingElement = {
                                expressID: element.expressID,
                                GlobalID: element.GlobalId.value,
                                type: element.type,
                                name: element.Name.value,
                                properties: []
                            };   
                            
                OBC.IfcPropertiesUtils.getPsetProps(loadedModel,propertySetID,(async (propertyId) => {
                    const property = elements[propertyId];
                    if(!property)
                        return;

                    newElement.properties.push({
                        name: property.Name.value,
                        value: property.NominalValue.value})
                
                    // const propertyName = property.Name?.value;
                    // const propertyValue = property.NominalValue?.value;
                    // if (propertyName) {
                    //     newElement.properties.push({ name: propertyName, value: propertyValue });
                    // }

                    // if(propertyName && propertyName.toLowerCase === "name")
                    //     {newElement.name = propertyValue;}
                }))
                foundElements.push(newElement)
            }
        })
    } ))
    //console.log("building Elements",foundElements)
    return foundElements;
}