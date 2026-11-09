import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Modal } from './overlays';
import { PasswordInput, passwordScore } from './PasswordInput';
import { useToast } from './toast';
import { Button, ErrorNote } from './ui';

/** The signed-in person changes their own password. */
export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setCurrent('');
    setNext('');
    setAgain('');
    setError(null);
    onClose();
  };

  const save = useMutation({
    mutationFn: () => api('/auth/password', { body: { currentPassword: current, newPassword: next } }),
    onSuccess: () => {
      toast.success('Your password was changed.');
      close();
    },
    onError: (e: Error) => setError(e.message),
  });

  const valid = current.length > 0 && passwordScore(next) >= 3 && /[A-Za-z]/.test(next) && /\d/.test(next) && next.length >= 8 && next === again;

  return (
    <Modal
      open={open}
      onClose={close}
      title="Change your password"
      footer={
        <>
          <Button variant="soft" onClick={close}>
            Cancel
          </Button>
          <Button loading={save.isPending} disabled={!valid} onClick={() => { setError(null); save.mutate(); }}>
            Save password
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <ErrorNote message={error} />}
        <PasswordInput label="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        <PasswordInput label="New password" meter value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        <PasswordInput label="Type the new password again" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" error={again && next !== again ? 'The two passwords do not match.' : undefined} />
      </div>
    </Modal>
  );
}
