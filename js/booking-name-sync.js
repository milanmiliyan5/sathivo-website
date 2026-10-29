// Read-only display enhancement. Booking records themselves retain their
// original snapshots and status; only a booking participant may see live names.
// Shared between bookings, incoming requests, the inbox and booking chat.
export async function withCurrentBookingNames(client, records = []) {
  if (!Array.isArray(records) || records.length === 0) return records || [];
  const ids = [...new Set(records.map(row => row.booking_id || row.id).filter(Boolean))];
  if (!ids.length || !client?.rpc) return records;
  try {
    const byId = new Map();
    // The RPC returns no more than 200 rows; batch accordingly.
    for (let offset = 0; offset < ids.length; offset += 200) {
      const { data, error } = await client.rpc('sathivo_booking_names', {
        p_booking_ids: ids.slice(offset, offset + 200),
      });
      if (error) throw error;
      for (const current of data || []) byId.set(current.booking_id, current);
    }
    return records.map(row => {
      const current = byId.get(row.booking_id || row.id);
      if (!current) return row;
      const updated = {
        ...row,
        customer_display_name: current.customer_display_name,
        companion_display_name: current.companion_display_name,
      };
      if (row.other_user_id) {
        if (row.other_user_id === current.customer_id)
          updated.other_display_name = current.customer_display_name;
        else if (row.other_user_id === current.companion_id)
          updated.other_display_name = current.companion_display_name;
      }
      return updated;
    });
  } catch {
    // Offline / deployment lag: keep already authorized booking snapshot data.
    return records;
  }
}
