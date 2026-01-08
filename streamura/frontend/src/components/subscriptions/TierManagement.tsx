import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, GripVertical, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  subscriptionApi,
  type SubscriptionTier,
  type SubscriptionTierCreate,
  type SubscriptionTierUpdate,
} from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface TierManagementProps {
  creatorId: number;
}

interface TierFormData {
  name: string;
  description: string;
  price: string;
  billing_period: 'monthly' | 'yearly';
  benefits: string;
  max_subscribers: string;
  badge_url: string;
  emote_slots: string;
}

const defaultFormData: TierFormData = {
  name: '',
  description: '',
  price: '',
  billing_period: 'monthly',
  benefits: '',
  max_subscribers: '',
  badge_url: '',
  emote_slots: '0',
};

export function TierManagement({ creatorId }: TierManagementProps) {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<SubscriptionTier | null>(null);
  const [formData, setFormData] = useState<TierFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadTiers();
  }, [creatorId]);

  const loadTiers = async () => {
    try {
      const data = await subscriptionApi.getTiers(creatorId, true);
      setTiers(data);
    } catch (error) {
      console.error('Failed to load tiers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load subscription tiers',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingTier(null);
    setFormData(defaultFormData);
    setDialogOpen(true);
  };

  const openEditDialog = (tier: SubscriptionTier) => {
    setEditingTier(tier);
    setFormData({
      name: tier.name,
      description: tier.description || '',
      price: tier.price.toString(),
      billing_period: tier.billing_period as 'monthly' | 'yearly',
      benefits: tier.benefits?.join('\n') || '',
      max_subscribers: tier.max_subscribers?.toString() || '',
      badge_url: tier.badge_url || '',
      emote_slots: tier.emote_slots.toString(),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price) {
      toast({
        title: 'Error',
        description: 'Name and price are required',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const benefits = formData.benefits
        .split('\n')
        .map((b) => b.trim())
        .filter((b) => b.length > 0);

      if (editingTier) {
        const updateData: SubscriptionTierUpdate = {
          name: formData.name,
          description: formData.description || undefined,
          price: parseFloat(formData.price),
          benefits,
          max_subscribers: formData.max_subscribers ? parseInt(formData.max_subscribers) : undefined,
          badge_url: formData.badge_url || undefined,
          emote_slots: parseInt(formData.emote_slots) || 0,
        };

        await subscriptionApi.updateTier(editingTier.id, updateData);
        toast({
          title: 'Success',
          description: 'Tier updated successfully',
        });
      } else {
        const createData: SubscriptionTierCreate = {
          name: formData.name,
          price: parseFloat(formData.price),
          description: formData.description || undefined,
          billing_period: formData.billing_period,
          benefits,
          max_subscribers: formData.max_subscribers ? parseInt(formData.max_subscribers) : undefined,
          badge_url: formData.badge_url || undefined,
          emote_slots: parseInt(formData.emote_slots) || 0,
        };

        await subscriptionApi.createTier(creatorId, createData);
        toast({
          title: 'Success',
          description: 'Tier created successfully',
        });
      }

      setDialogOpen(false);
      loadTiers();
    } catch (error) {
      console.error('Failed to save tier:', error);
      toast({
        title: 'Error',
        description: 'Failed to save tier',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tier: SubscriptionTier) => {
    if (!confirm(`Are you sure you want to deactivate the "${tier.name}" tier?`)) {
      return;
    }

    try {
      await subscriptionApi.deleteTier(tier.id);
      toast({
        title: 'Success',
        description: 'Tier deactivated successfully',
      });
      loadTiers();
    } catch (error) {
      console.error('Failed to delete tier:', error);
      toast({
        title: 'Error',
        description: 'Failed to deactivate tier',
        variant: 'destructive',
      });
    }
  };

  const toggleTierActive = async (tier: SubscriptionTier) => {
    try {
      await subscriptionApi.updateTier(tier.id, { is_active: !tier.is_active });
      loadTiers();
    } catch (error) {
      console.error('Failed to toggle tier:', error);
      toast({
        title: 'Error',
        description: 'Failed to update tier',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Subscription Tiers</h2>
          <p className="text-muted-foreground">
            Manage your subscription tiers and benefits
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Create Tier
        </Button>
      </div>

      {tiers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Subscription Tiers</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create subscription tiers to let your audience support you with monthly payments.
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Tier
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tiers.map((tier) => (
            <Card key={tier.id} className={!tier.is_active ? 'opacity-60' : ''}>
              <CardHeader className="flex flex-row items-center gap-4">
                <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    {tier.name}
                    {tier.badge_url && (
                      <img src={tier.badge_url} alt="" className="h-5 w-5" />
                    )}
                  </CardTitle>
                  <CardDescription>
                    ${tier.price}/{tier.billing_period === 'yearly' ? 'year' : 'mo'} - {tier.current_subscribers} subscriber{tier.current_subscribers !== 1 ? 's' : ''}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={tier.is_active}
                    onCheckedChange={() => toggleTierActive(tier)}
                  />
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(tier)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(tier)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              {tier.benefits && tier.benefits.length > 0 && (
                <CardContent>
                  <ul className="list-disc list-inside text-sm text-muted-foreground">
                    {tier.benefits.slice(0, 3).map((benefit, i) => (
                      <li key={i}>{benefit}</li>
                    ))}
                    {tier.benefits.length > 3 && (
                      <li>+{tier.benefits.length - 3} more benefits</li>
                    )}
                  </ul>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTier ? 'Edit Tier' : 'Create Tier'}</DialogTitle>
            <DialogDescription>
              {editingTier
                ? 'Update your subscription tier details.'
                : 'Create a new subscription tier for your supporters.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tier Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Supporter, VIP, Premium"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price (USD) *</Label>
                <Input
                  id="price"
                  type="number"
                  min="1"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="4.99"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billing_period">Billing Period</Label>
                <Select
                  value={formData.billing_period}
                  onValueChange={(value: string) =>
                    setFormData({ ...formData, billing_period: value as 'monthly' | 'yearly' })
                  }
                  disabled={!!editingTier}
                >
                  <SelectTrigger id="billing_period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What do subscribers get?"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="benefits">Benefits (one per line)</Label>
              <Textarea
                id="benefits"
                value={formData.benefits}
                onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
                placeholder="Ad-free viewing&#10;Exclusive emotes&#10;Subscriber badge"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_subscribers">Max Subscribers</Label>
                <Input
                  id="max_subscribers"
                  type="number"
                  min="1"
                  value={formData.max_subscribers}
                  onChange={(e) => setFormData({ ...formData, max_subscribers: e.target.value })}
                  placeholder="Unlimited"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emote_slots">Emote Slots</Label>
                <Input
                  id="emote_slots"
                  type="number"
                  min="0"
                  value={formData.emote_slots}
                  onChange={(e) => setFormData({ ...formData, emote_slots: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="badge_url">Badge URL</Label>
              <Input
                id="badge_url"
                type="url"
                value={formData.badge_url}
                onChange={(e) => setFormData({ ...formData, badge_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingTier ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TierManagement;
