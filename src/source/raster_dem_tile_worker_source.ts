import {DEMData} from '../data/dem_data';
import {RGBAImage} from '../util/image';
import type {Actor} from '../util/actor';
import type {
    WorkerDEMTileParameters,
    TileParameters
} from './worker_source';
import {getImageData, isImageBitmap} from '../util/util';

// GEOS - Charge une tile PNG

export class RasterDEMTileWorkerSource {
    actor: Actor;
    loaded: {[_: string]: DEMData};

    constructor() {
        this.loaded = {};
    }

    async loadTile(params: WorkerDEMTileParameters): Promise<DEMData | null> {
        const {uid, rawImageData} = params;
        // const width = rawImageData.width + 2;
        // const height = rawImageData.height + 2;

        // GEOS - L'image peut être width * n si on stocke séparément le bâti et la végétation

        // Si le png fait 512, on ajoute une bordure de 1px
        const padding = rawImageData.height == 512 ? -1 : 0;

        // ?? comprend pas pq on ne peut pas assigner directement imagePixels = RGBAImage()
        const imagePixels: RGBAImage | ImageData = isImageBitmap(rawImageData) ?
            new RGBAImage({ width:514, height:514 }, await getImageData(rawImageData, padding, padding, 514, 514)) :
            rawImageData;

        const imageStats: RGBAImage | ImageData = isImageBitmap(rawImageData) ?
            new RGBAImage({ width:1, height:514 }, await getImageData(rawImageData, 514, 0, 1, 514)) :
            rawImageData;

        const dem = new DEMData(uid, imagePixels, imageStats);
        this.loaded = this.loaded || {};
        this.loaded[uid] = dem;

        return dem;
    }

    removeTile(params: TileParameters) {
        const loaded = this.loaded,
            uid = params.uid;
        if (loaded && loaded[uid]) {
            delete loaded[uid];
        }
    }
}
