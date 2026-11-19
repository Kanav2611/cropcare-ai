import * as tf from '@tensorflow/tfjs';
import * as tmImage from '@teachablemachine/image';

const MODEL_URL = '/model/';

export async function loadModel() {
    const modelURL = MODEL_URL + 'model.json';
    const metadataURL = MODEL_URL + 'metadata.json';

    const model = await tmImage.load(modelURL, metadataURL);
    return model;
}

export async function predictImage(model: tmImage.CustomMobileNet, imageElement: HTMLImageElement) {
    const predictions = await model.predict(imageElement);
    return predictions;
}