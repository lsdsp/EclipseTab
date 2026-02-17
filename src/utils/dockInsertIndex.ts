export const resolveDockInsertIndex = (mouseX: number, itemCenters: number[]): number => {
  for (let i = 0; i < itemCenters.length; i++) {
    if (mouseX < itemCenters[i]) {
      return i;
    }
  }

  return itemCenters.length;
};

