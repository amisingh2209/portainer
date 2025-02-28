import { Server } from 'lucide-react';
import { useCurrentStateAndParams } from '@uirouter/react';
import { useMemo } from 'react';
import { ContainerStatus, Pod } from 'kubernetes-types/core/v1';

import { IndexOptional } from '@/react/kubernetes/configs/types';
import { createStore } from '@/react/kubernetes/datatables/default-kube-datatable-store';
import { useEnvironment } from '@/react/portainer/environments/queries';

import { Datatable } from '@@/datatables';
import { useTableState } from '@@/datatables/useTableState';

import { useApplication, useApplicationPods } from '../../application.queries';

import { ContainerRowData } from './types';
import { getColumns } from './columns';

const storageKey = 'k8sContainersDatatable';
const settingsStore = createStore(storageKey);

export function ApplicationContainersDatatable() {
  const tableState = useTableState(settingsStore, storageKey);
  const {
    params: {
      endpointId: environmentId,
      name,
      namespace,
      'resource-type': resourceType,
    },
  } = useCurrentStateAndParams();

  // get the containers from the aapplication pods
  const { data: application, ...applicationQuery } = useApplication(
    environmentId,
    namespace,
    name,
    resourceType
  );
  const { data: pods, ...podsQuery } = useApplicationPods(
    environmentId,
    namespace,
    name,
    application
  );
  const appContainers = useContainersRowData(pods);

  const { data: isServerMetricsEnabled } = useEnvironment(
    environmentId,
    (environment) => !!environment?.Kubernetes?.Configuration.UseServerMetrics
  );

  return (
    <Datatable<IndexOptional<ContainerRowData>>
      dataset={appContainers}
      columns={getColumns(!!isServerMetricsEnabled)}
      settingsManager={tableState}
      isLoading={applicationQuery.isLoading || podsQuery.isLoading}
      emptyContentLabel="No containers found"
      title="Application containers"
      titleIcon={Server}
      getRowId={(row) => row.name}
      disableSelect
    />
  );
}

// useContainersRowData row data gets the pod.spec?.containers and pod.spec?.initContainers from an array of pods
// it then appends the podName, nodeName, podId, creationDate, and status to each container
function useContainersRowData(pods?: Pod[]): ContainerRowData[] {
  return (
    useMemo(
      () =>
        pods?.flatMap((pod) => {
          const containers = [
            ...(pod.spec?.containers || []),
            ...(pod.spec?.initContainers || []),
          ];
          return containers.map((container) => ({
            ...container,
            podName: pod.metadata?.name ?? '',
            nodeName: pod.spec?.nodeName ?? '',
            podIp: pod.status?.podIP ?? '',
            creationDate: pod.status?.startTime ?? '',
            status: computeContainerStatus(
              container.name,
              pod.status?.containerStatuses
            ),
          }));
        }) || [],
      [pods]
    ) || []
  );
}

function computeContainerStatus(
  containerName: string,
  statuses?: ContainerStatus[]
) {
  const status = statuses?.find((status) => status.name === containerName);
  if (!status) {
    return 'Terminated';
  }
  const { state } = status;
  if (state?.waiting) {
    return 'Waiting';
  }
  if (!state?.running) {
    return 'Terminated';
  }
  return 'Running';
}
