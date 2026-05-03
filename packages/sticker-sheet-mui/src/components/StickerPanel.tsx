import type { CSSProperties } from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';

export interface StickerPanelProps {
  mode: string;
  label: string;
}

export function StickerPanel({ mode, label }: StickerPanelProps) {
  const rootStyle: CSSProperties = {
    background: 'var(--mui-palette-background-default)',
    color: 'var(--mui-palette-text-primary)',
    border: '1px solid var(--mui-palette-divider)',
    borderRadius: 12,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  };

  return (
    <section data-color-scheme={mode} style={rootStyle} aria-label={`Mode: ${mode}`}>
      <PanelHeader label={label} mode={mode} />
      <DefaultSheet />
    </section>
  );
}

function PanelHeader({ label, mode }: { label: string; mode: string }) {
  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: '0.02em' }}>
        {label}
      </Typography>
      <code style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--mui-palette-text-secondary)' }}>
        {mode}
      </code>
    </header>
  );
}

function DefaultSheet() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <TypographySection />
      <ButtonRow />
      <FeedbackAlerts />
      <ElevatedCard />
      <BorderSection />
      <InputSection />
    </div>
  );
}

function TypographySection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Typography variant="h6" sx={{ fontSize: 20, fontWeight: 600 }}>
        Heading on main surface
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Muted supporting copy on the main surface.
      </Typography>
    </div>
  );
}

function ButtonRow() {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Button variant="contained" color="primary" size="small">
        Primary
      </Button>
      <Button variant="outlined" color="primary" size="small">
        Outlined
      </Button>
      <Button variant="contained" color="secondary" size="small">
        Secondary
      </Button>
      <Button variant="text" size="small">
        Text
      </Button>
      <Button variant="contained" color="error" size="small">
        Error
      </Button>
      <Button variant="contained" color="primary" size="small" disabled>
        Disabled
      </Button>
    </div>
  );
}

function FeedbackAlerts() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Typography variant="overline" sx={{ fontSize: 11, letterSpacing: '0.06em', opacity: 0.8 }}>
        Feedback
      </Typography>
      <Alert severity="success" sx={{ py: 0.5 }}>Success — accessible on the main surface.</Alert>
      <Alert severity="error" sx={{ py: 0.5 }}>Error — destructive states and actions.</Alert>
      <Alert severity="warning" sx={{ py: 0.5 }}>Warning — caution and attention.</Alert>
      <Alert severity="info" sx={{ py: 0.5 }}>Info — hints and informational panels.</Alert>
    </div>
  );
}

function ElevatedCard() {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.75,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        background: 'var(--mui-palette-background-paper)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle2">Elevated card</Typography>
        <Chip label="badge" size="small" variant="outlined" />
      </div>
      <Typography variant="caption" color="text.secondary">
        Rendered on <code>background.paper</code> (<code>surface.elevated</code>) with a divider
        outline.
      </Typography>
    </Paper>
  );
}

function BorderSection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Typography variant="overline" sx={{ fontSize: 11, letterSpacing: '0.06em', opacity: 0.8 }}>
        Divider
      </Typography>
      <Divider />
      <Typography variant="caption" color="text.secondary">
        <code>divider</code> → <code>border.main</code>
      </Typography>
    </div>
  );
}

function InputSection() {
  return (
    <TextField
      label="Email"
      placeholder="you@example.com"
      type="email"
      size="small"
      variant="outlined"
      helperText="We never share your address."
      fullWidth
    />
  );
}
