/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React, { useState, useEffect, useMemo } from 'react';
import rison from 'rison';
import {
  SupersetClient,
  styled,
  t,
  TimeRangeEndpoints,
  useTheme,
} from '@superset-ui/core';
import { buildTimeRangeString, formatTimeRange } from './utils';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import Button from 'src/components/Button';
import ControlHeader from 'src/explore/components/ControlHeader';
import Label, { Type } from 'src/components/Label';
import Popover from 'src/components/Popover';
import { Divider } from 'src/components';
import Icons from 'src/components/Icons';
import { Tooltip } from 'src/components/Tooltip';
import { DEFAULT_TIME_RANGE, NO_TIME_RANGE } from 'src/explore/constants';
import { useDebouncedEffect } from 'src/explore/exploreUtils';
import { SLOW_DEBOUNCE } from 'src/constants';
import { testWithId } from 'src/utils/testUtils';
import { FrameType } from './types';

import { CustomFrame } from './components';
import moment from 'moment';

const guessFrame = (timeRange: string): FrameType => {
  if (timeRange === 'No filter') {
    return 'No filter';
  }
  return 'Custom';
};

const fetchTimeRange = async (
  timeRange: string,
  endpoints?: TimeRangeEndpoints,
) => {
  const query = rison.encode(timeRange);
  const endpoint = `/api/v1/time_range/?q=${query}`;
  try {
    const response = await SupersetClient.get({ endpoint });
    const timeRangeString = buildTimeRangeString(
      response?.json?.result?.since || '',
      response?.json?.result?.until || '',
    );
    return {
      value: formatTimeRange(timeRangeString, endpoints),
    };
  } catch (response) {
    const clientError = await getClientErrorObject(response);
    return {
      error: clientError.message || clientError.error,
    };
  }
};

const StyledPopover = styled(Popover)``;

const ContentStyleWrapper = styled.div`
  .ant-row {
    margin-top: 8px;
  }

  .ant-input-number {
    width: 100%;
  }

  .ant-picker {
    padding: 4px 17px 4px;
    border-radius: 4px;
    width: 100%;
  }

  .ant-divider-horizontal {
    margin: 16px 0;
  }

  .control-label {
    font-size: 11px;
    font-weight: 500;
    color: #b2b2b2;
    line-height: 16px;
    text-transform: uppercase;
    margin: 8px 0;
  }

  .vertical-radio {
    display: block;
    height: 40px;
    line-height: 40px;
  }

  .section-title {
    font-style: normal;
    font-weight: 500;
    font-size: 15px;
    line-height: 24px;
    margin-bottom: 8px;
  }

  .control-anchor-to {
    margin-top: 16px;
  }

  .control-anchor-to-datetime {
    width: 217px;
  }

  .footer {
    text-align: right;
  }
`;

const IconWrapper = styled.span`
  span {
    margin-right: ${({ theme }) => 2 * theme.gridUnit}px;
    vertical-align: middle;
  }
  .text {
    vertical-align: middle;
  }
  .error {
    color: ${({ theme }) => theme.colors.error.base};
  }
`;

const Footer = styled.div`
  display: flex;
  justify-content: space-between;
`;

interface DateFilterControlProps {
  name: string;
  onChange: (timeRange: string) => void;
  value?: string;
  endpoints?: TimeRangeEndpoints;
  type?: Type;
}

export const DATE_FILTER_CONTROL_TEST_ID = 'date-filter-control';
export const getDateFilterControlTestId = testWithId(
  DATE_FILTER_CONTROL_TEST_ID,
);

function changeDateFormat(range: string) {
  if (!range || range === NO_TIME_RANGE) return range;
  if (range.indexOf(' ≤ ') === -1) {
    const [start, end] = range.split(' : ');
    return `${moment(start).format('YYYY-MM-DD')} : ${moment(end).format(
      'YYYY-MM-DD',
    )}`;
  }
  const [start, mid, end] = range.split(' ≤ ');
  return `${moment(start).format('YYYY-MM-DD')} ≤ ${mid} ≤ ${moment(end).format(
    'YYYY-MM-DD',
  )}`;
}

export default function DateFilterLabel(props: DateFilterControlProps) {
  const { value = DEFAULT_TIME_RANGE, endpoints, onChange, type } = props;
  const [actualTimeRange, setActualTimeRange] = useState<string>(value);

  const [show, setShow] = useState<boolean>(false);
  const guessedFrame = useMemo(() => guessFrame(value), [value]);
  const [lastFetchedTimeRange, setLastFetchedTimeRange] = useState(value);
  const [timeRangeValue, setTimeRangeValue] = useState(value);
  const [validTimeRange, setValidTimeRange] = useState<boolean>(false);
  const [evalResponse, setEvalResponse] = useState<string>(value);
  const [tooltipTitle, setTooltipTitle] = useState<string>(value);

  useEffect(() => {
    fetchTimeRange(value, endpoints).then(({ value: actualRange, error }) => {
      if (error) {
        setEvalResponse(error || '');
        setValidTimeRange(false);
        setTooltipTitle(value || '');
      } else {
        /*
           HRT == human readable text
           ADR == actual datetime range
           +--------------+------+----------+--------+----------+-----------+
           |              | Last | Previous | Custom | Advanced | No Filter |
           +--------------+------+----------+--------+----------+-----------+
           | control pill | HRT  | HRT      | ADR    | ADR      |   HRT     |
           +--------------+------+----------+--------+----------+-----------+
           | tooltip      | ADR  | ADR      | HRT    | HRT      |   ADR     |
           +--------------+------+----------+--------+----------+-----------+
         */
        if (guessedFrame === 'No filter') {
          setActualTimeRange(value);
          setTooltipTitle(
            type === ('error' as Type)
              ? t('Default value is required')
              : actualRange || '',
          );
        } else {
          setActualTimeRange(actualRange || '');
          setTooltipTitle(value || '');
        }
        setValidTimeRange(true);
      }
      setLastFetchedTimeRange(value);
    });
  }, [value]);

  useEffect(() => {
    setTimeRangeValue(actualTimeRange);
  }, [actualTimeRange]);

  useDebouncedEffect(
    () => {
      if (lastFetchedTimeRange !== timeRangeValue) {
        fetchTimeRange(timeRangeValue, endpoints).then(
          ({ value: actualRange, error }) => {
            if (error) {
              setEvalResponse(error || '');
              setValidTimeRange(false);
            } else {
              setEvalResponse(actualRange || '');
              setValidTimeRange(true);
            }
            setLastFetchedTimeRange(timeRangeValue);
          },
        );
      }
    },
    SLOW_DEBOUNCE,
    [timeRangeValue],
  );

  function onSave() {
    onChange(timeRangeValue);
    setShow(false);
  }

  function onOpen() {
    setTimeRangeValue(value);
    setShow(true);
  }

  function onHide() {
    setTimeRangeValue(value);
    setShow(false);
  }

  const togglePopover = () => {
    if (show) {
      onHide();
    } else {
      setShow(true);
    }
  };

  const theme = useTheme();

  const overlayContent = (
    <ContentStyleWrapper>
      <CustomFrame value={timeRangeValue} onChange={setTimeRangeValue} />
      <Divider />
      <div>
        <div className="section-title">{t('Actual time range')}</div>
        {validTimeRange && <div>{changeDateFormat(evalResponse)}</div>}
        {!validTimeRange && (
          <IconWrapper className="warning">
            <Icons.ErrorSolidSmall iconColor={theme.colors.error.base} />
            <span className="text error">{evalResponse}</span>
          </IconWrapper>
        )}
      </div>
      <Divider />
      <Footer>
        <Button
          buttonStyle="danger"
          cta
          key="No filter"
          onClick={() => {
            setTimeRangeValue(NO_TIME_RANGE);
            onChange(NO_TIME_RANGE);
            setShow(false);
          }}
          data-test="no-filter-button"
        >
          No Filter
        </Button>

        <div>
          <Button
            buttonStyle="secondary"
            cta
            key="cancel"
            onClick={onHide}
            data-test="cancel-button"
          >
            {t('CANCEL')}
          </Button>
          <Button
            buttonStyle="primary"
            cta
            disabled={!validTimeRange}
            key="apply"
            onClick={onSave}
            {...getDateFilterControlTestId('apply-button')}
          >
            {t('APPLY')}
          </Button>
        </div>
      </Footer>
    </ContentStyleWrapper>
  );

  const title = (
    <IconWrapper>
      <Icons.EditAlt iconColor={theme.colors.grayscale.base} />
      <span className="text">{t('Edit time range')}</span>
    </IconWrapper>
  );

  const overlayStyle = {
    width: '600px',
  };

  return (
    <>
      <ControlHeader {...props} />
      <StyledPopover
        placement="right"
        trigger="click"
        content={overlayContent}
        title={title}
        defaultVisible={show}
        visible={show}
        onVisibleChange={togglePopover}
        overlayStyle={overlayStyle}
      >
        <Tooltip placement="top" title={tooltipTitle}>
          <Label
            className="pointer"
            data-test="time-range-trigger"
            onClick={onOpen}
          >
            {changeDateFormat(actualTimeRange)}
          </Label>
        </Tooltip>
      </StyledPopover>
    </>
  );
}
