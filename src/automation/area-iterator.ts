import { getCitiesForState, getAreasForCity } from '../config/location-data';

export interface AreaIteration {
  city: string;
  area: string;
}

export class AreaIterator {
  iterate(state: string, cities: string[]): AreaIteration[] {
    const results: AreaIteration[] = [];

    for (const city of cities) {
      const areas = this.getAreas(state, city);
      for (const area of areas) {
        results.push({ city, area });
      }
    }

    return results;
  }

  getCities(state: string): string[] {
    return getCitiesForState(state);
  }

  getAreas(state: string, city: string): string[] {
    return getAreasForCity(state, city);
  }

  countJobs(state: string, cities: string[], businessTypes: string[]): number {
    let areaCount = 0;
    for (const city of cities) {
      areaCount += this.getAreas(state, city).length;
    }
    return areaCount * businessTypes.length;
  }
}

export const areaIterator = new AreaIterator();
