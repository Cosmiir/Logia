// Types for Review Templates

export interface ReviewTemplate {
  id: number;
  name: string;
  icon: string;
  color: string;
  content: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateReviewTemplateDto {
  name: string;
  icon: string;
  color?: string;
  content: string;
}

export interface UpdateReviewTemplateDto {
  template_id: number;
  name?: string;
  icon?: string;
  color?: string;
  content?: string;
}
