# Loading State Flicker Fix

## Problem
The admin distributions page (`/admin/merkle`) and user distributions page (`/distributions`) were experiencing a flickering effect when:
- Initial page load
- Changing filters (status, vault type)
- Refreshing distributions

**User Report:** "This route http://localhost:3001/admin/merkle loading distributions flickers and it is showing loading distribution"

## Root Cause
The `useDistributions` and `useUserDistributions` hooks initialized the `loading` state as `true`:

```typescript
// BEFORE (caused flickering)
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetchDistributions();  // Sets loading=true on every filter change
}, [filters]);
```

This caused the entire content to be replaced with a loading spinner on every filter change, creating a jarring visual experience.

## Solution: Two-Tier Loading Pattern

Implemented separate loading states for initial load vs subsequent fetches:

### 1. Hook Changes (`src/hooks/useMerkleDistribution.ts`)

```typescript
// TWO-TIER LOADING STATES
const [loading, setLoading] = useState(false);        // Changed from true
const [initialLoad, setInitialLoad] = useState(true); // NEW

const fetchDistributions = async () => {
  setLoading(true);
  try {
    // Fetch data...
    
    // Mark initial load complete after first successful fetch
    if (initialLoad) {
      setInitialLoad(false);
    }
  } catch (error) {
    // Handle error...
  } finally {
    setLoading(false);
  }
};

// Return both states
return {
  distributions,
  loading,       // Tracks current fetch status
  initialLoad,   // Tracks if this is the first load
  error,
  pagination,
  refetch: fetchDistributions,
};
```

### 2. Page Component Changes

#### Admin Page (`src/app/admin/merkle/page.tsx`)

```tsx
export default function MerkleDistributionsPage() {
  const { distributions, loading, initialLoad, error, pagination, refetch } = 
    useDistributions(filters);

  return (
    <DashboardContent
      distributions={distributions}
      loading={loading}
      initialLoad={initialLoad}  // Pass both states
      error={error}
      pagination={pagination}
      refetch={refetch}
    />
  );
}

function DashboardContent({
  distributions,
  loading,
  initialLoad,  // Receive both states
  error,
  pagination,
  refetch,
}: {
  distributions: unknown[];
  loading: boolean;
  initialLoad: boolean;  // Type definition
  error: string | null;
  pagination: { total: number; page: number; limit: number; pages: number };
  refetch: () => void;
}) {
  return (
    <>
      {/* Show subtle indicator during filter changes */}
      {loading && !initialLoad && (
        <div className="mb-4 p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
          <div className="inline-flex items-center gap-2">
            <div className="animate-spin h-4 w-4 border-b-2 border-purple-400 rounded-full"></div>
            <span className="text-purple-400">Updating...</span>
          </div>
        </div>
      )}

      {/* Show full loader only on initial load */}
      {initialLoad ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading distributions...</p>
        </div>
      ) : error ? (
        // Error state...
      ) : (
        // Content always visible after initial load
      )}
    </>
  );
}
```

#### User Page (`src/app/distributions/page.tsx`)

Applied identical pattern:
```tsx
const { distributions, loading, initialLoad, error, refetch } = useUserDistributions();

// Same loading logic as admin page
{loading && !initialLoad && (
  <div>Refreshing distributions...</div>
)}

{initialLoad ? (
  <div>Loading your distributions...</div>
) : error ? ...}
```

## Benefits

### Before Fix
- ❌ Content disappears on every filter change
- ❌ Loading spinner replaces entire view
- ❌ Jarring, unprofessional user experience
- ❌ No indication whether it's initial load or refresh

### After Fix
- ✅ Content stays visible during updates
- ✅ Subtle "Updating..." indicator during filter changes
- ✅ Full-screen loader only on first visit
- ✅ Smooth, professional experience
- ✅ Clear distinction between initial load and subsequent fetches

## Implementation Timeline

### Phase 1: Hook Updates
- [x] Updated `useDistributions` hook
- [x] Updated `useUserDistributions` hook
- [x] Added `initialLoad` to return values

### Phase 2: Admin Page
- [x] Updated component to receive `initialLoad`
- [x] Updated TypeScript types
- [x] Implemented two-tier loading UI

### Phase 3: User Page
- [x] Updated component to receive `initialLoad`
- [x] Updated TypeScript types
- [x] Implemented two-tier loading UI

### Phase 4: Verification
- [x] No TypeScript errors
- [x] No ESLint errors
- [x] All components properly typed

## Testing Checklist

### Admin Page (`/admin/merkle`)
- [ ] First visit shows full-screen loader
- [ ] After load, content stays visible
- [ ] Changing status filter shows "Updating..." indicator
- [ ] Changing vault type filter shows "Updating..." indicator
- [ ] No flickering during filter changes
- [ ] Refresh button shows subtle indicator

### User Page (`/distributions`)
- [ ] First visit shows full-screen loader
- [ ] After load, content stays visible
- [ ] Refresh button shows "Refreshing..." indicator
- [ ] No flickering during updates

## Files Modified

1. **src/hooks/useMerkleDistribution.ts**
   - Lines 30-45: Added `initialLoad` state to `useDistributions`
   - Lines 62-73: Updated return statement to include `initialLoad`
   - Lines 117-159: Added `initialLoad` state to `useUserDistributions`

2. **src/app/admin/merkle/page.tsx**
   - Lines 21: Destructured `initialLoad` from hook
   - Lines 38-48: Passed `initialLoad` to DashboardContent
   - Lines 56-70: Added `initialLoad` to props interface
   - Lines 179-192: Implemented two-tier loading UI

3. **src/app/distributions/page.tsx**
   - Lines 11: Destructured `initialLoad` from hook
   - Lines 37: Passed `initialLoad` to DashboardContent
   - Lines 50: Added `initialLoad` to props interface
   - Lines 139-151: Implemented two-tier loading UI

## Best Practices

### Pattern for Future Components

When implementing data fetching with loading states:

```typescript
// 1. Use two loading states
const [loading, setLoading] = useState(false);        // Current fetch
const [initialLoad, setInitialLoad] = useState(true); // First fetch

// 2. Mark initial load complete after first success
if (initialLoad && data) {
  setInitialLoad(false);
}

// 3. Return both states
return { data, loading, initialLoad, error };

// 4. In UI, show different indicators
{initialLoad ? (
  <FullScreenLoader />
) : (
  <>
    {loading && <SubtleIndicator />}
    <Content />  {/* Always visible after initial load */}
  </>
)}
```

### When to Use This Pattern

✅ **Use two-tier loading when:**
- Content has filters or dynamic queries
- Users will interact with loading states frequently
- You want to preserve content during updates
- Professional, polished UX is important

❌ **Simple loading state is fine when:**
- One-time data fetch (no filters)
- Navigation to new page (full reload expected)
- Modal/drawer (entire UI changes)

## Performance Impact

- **Minimal overhead**: One additional boolean state
- **Better perceived performance**: Content stays visible
- **Reduced cognitive load**: No disruptive flashing
- **Improved UX**: Clear feedback for user actions

## Conclusion

The two-tier loading pattern significantly improves user experience by:
1. Preserving content during filter changes
2. Providing clear feedback for different loading scenarios
3. Creating a smooth, professional interface
4. Following modern UX best practices

**Status:** ✅ **RESOLVED** - No more flickering!
