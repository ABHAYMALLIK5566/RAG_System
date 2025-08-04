import React from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  Chip,
  Divider,
  Link,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  Description as DocumentIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { useAppSelector } from '../../store';

const SourcesPanel = () => {
  const { currentSession } = useAppSelector((state) => state.chat);
  const [expandedSources, setExpandedSources] = React.useState<Set<string>>(new Set());

  const toggleSource = (sourceId: string) => {
    const newExpanded = new Set(expandedSources);
    if (newExpanded.has(sourceId)) {
      newExpanded.delete(sourceId);
    } else {
      newExpanded.add(sourceId);
    }
    setExpandedSources(newExpanded);
  };

  // Collect all sources from assistant messages
  const allSources = currentSession?.messages
    .filter(msg => msg.role === 'assistant' && msg.metadata?.sources)
    .flatMap(msg => msg.metadata!.sources!)
    .filter((source, index, self) => 
      self.findIndex(s => s.title === source.title) === index
    ) || [];

  const getSourceUsageCount = (sourceTitle: string) => {
    return currentSession?.messages
      .filter(msg => msg.role === 'assistant' && msg.metadata?.sources)
      .filter(msg => msg.metadata!.sources!.some(s => s.title === sourceTitle))
      .length || 0;
  };

  if (!currentSession) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          No active conversation
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Sources
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {allSources.length} documents referenced
        </Typography>
      </Box>

      {/* Sources List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {allSources.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No sources yet
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Sources will appear here when the assistant responds
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {allSources.map((source, index) => {
              const sourceId = `${source.title}-${index}`;
              const usageCount = getSourceUsageCount(source.title);
              
              return (
                <React.Fragment key={sourceId}>
                  <ListItem disablePadding>
                    <Box sx={{ width: '100%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
                        <DocumentIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {source.title}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <Chip
                              label={`Used ${usageCount} time${usageCount !== 1 ? 's' : ''}`}
                              size="small"
                              variant="outlined"
                              color="primary"
                            />
                            {source.url && (
                              <IconButton
                                size="small"
                                component={Link}
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="View source"
                              >
                                <LinkIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={() => toggleSource(sourceId)}
                        >
                          {expandedSources.has(sourceId) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </Box>
                      
                      <Collapse in={expandedSources.has(sourceId)}>
                        <Box sx={{ px: 2, pb: 2 }}>
                          <Paper variant="outlined" sx={{ p: 1.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              {source.snippet}
                            </Typography>
                          </Paper>
                        </Box>
                      </Collapse>
                    </Box>
                  </ListItem>
                  {index < allSources.length - 1 && <Divider />}
                </React.Fragment>
              );
            })}
          </List>
        )}
      </Box>

      {/* Summary */}
      {allSources.length > 0 && (
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            Total sources: {allSources.length}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default SourcesPanel; 