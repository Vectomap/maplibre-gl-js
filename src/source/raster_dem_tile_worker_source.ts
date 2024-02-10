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

        const width = 514;
        const height = 514;
        const padding = rawImageData.height == 512 ? -1 : 0;

        const imagePixels: RGBAImage | ImageData = isImageBitmap(rawImageData) ?
            new RGBAImage({width, height}, await getImageData(rawImageData, padding, padding, width, height)) :
            rawImageData;

        const dem = new DEMData(uid, imagePixels);
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
