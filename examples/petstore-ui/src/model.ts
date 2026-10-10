import { FeatureModelSchema, type FeatureModel } from '@star-board/core';
import model from 'virtual:star-board/model';

/** The FeatureModel the screens were generated from, validated once at module load. */
export const MODEL: FeatureModel = FeatureModelSchema.parse(model);
