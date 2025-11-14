export interface Certificate {
    id: number;
    name: string;
    comment: string;
    subject: string;
    issuer: string;
    serial_number: string;
    not_before: string;
    not_after: string;
    is_expired: boolean;
    public_key_type: string;
    public_key_length: number;
    signature_algorithm: string;
    san: string[];
    cert_file: string;
    file_format: string;
    original_filename: string;
    cert_hash: string;
    issuer_hash: string;
    subject_hash: string;
    certificate_type: 'RootCA' | 'IntermediateCA' | 'Leaf';
    parent: number | null;
    children: Certificate[];
    access_teams: Team[];
    websites: Website[];
    has_private_key:boolean;
  }

export interface PrivateKey{
  id: number;
  name: string;
  comment: string
  encrypted_key_file: string;
  created_at: string;
  certificate: {
    id: number;
    name: string;
  } | null;
  keysize: number;
  uploaded_by: string;
  file_format: string;
  original_filename: string;
  access_teams: Team[];
}

export interface Team {
  id: number;
  name: string;
}

export interface Option {
  value: string;
  label: string;
}

export interface Website{
  id:     number;
  url:    string;
  domain: string;
  certificate: number;
}

export interface Secret {
  id: number;
  name: string;
  application: string;
  expiry_date: string | null;
  access_teams: Team[];
  comment: string | null;
  created_at: string;
  updated_at: string;
  created_by_email: string;
  is_expired: boolean;
}