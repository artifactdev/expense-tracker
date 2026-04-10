export interface Categories {
  id: string;
  name: string;
  common?: boolean;
  parentId?: string | null;
  children?: Categories[];
}

export interface EnhancedCategory extends Categories {
  newEntry?: boolean;
}
