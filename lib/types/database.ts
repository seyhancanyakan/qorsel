export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  role: 'user' | 'admin';
  credits: number;
  created_at: string;
  updated_at: string;
};

export type Job = {
  id: string;
  user_id: string;
  type: 'generate' | 'upscale';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  queue_position: number | null;
  prompt_id: string | null;
  parameters: {
    prompt1?: string;
    prompt2?: string;
    steps?: number;
    cfg?: number;
    width?: number;
    height?: number;
    resolution?: number;
    seed?: number;
    [key: string]: any;
  };
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type Image = {
  id: string;
  job_id: string;
  user_id: string;
  filename: string;
  comfy_filename: string | null;
  type: 'generated' | 'upscaled' | null;
  storage_path: string;
  created_at: string;
};
